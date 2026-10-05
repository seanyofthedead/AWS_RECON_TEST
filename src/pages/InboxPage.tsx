import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "../hooks/useDataProvider";
import { StatusPill } from "../components/StatusPill";
import { ConfidencePill } from "../components/ConfidencePill";
import { SkeletonTable } from "../components/SkeletonTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { InfoTooltip } from "../components/InfoTooltip";
import { CaseStatus, ConfidenceBand } from "../types/case";
import { TransactionRow } from "../types/transaction";
import { useInboxFiltersStore } from "../store/useInboxFiltersStore";
import { useToastStore } from "../store/toastStore";
import { getRootCauseLabel } from "../utils/rootCause";
import { measureDev } from "../utils/perf";
import { useRoutePerf } from "../hooks/useRoutePerf";
import { getPrimaryRecommendation } from "../utils/recommendations";
import { formatCurrency } from "../utils/formatCurrency";

export const InboxPage = () => {
  useRoutePerf("Inbox");
  const dataProvider = useDataProvider();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const hasErrorToasted = useRef(false);
  const defaultStatuses = [
    CaseStatus.ScreenedUnresolved,
    CaseStatus.Resolved,
    CaseStatus.Reviewed,
    CaseStatus.Escalated
  ];
  const defaultConfidenceBands = [
    ConfidenceBand.High,
    ConfidenceBand.Medium,
    ConfidenceBand.Low
  ];
  const statusLabels: Record<CaseStatus, string> = {
    [CaseStatus.ScreenedUnresolved]: "Open (in queue)",
    [CaseStatus.Resolved]: "Resolved",
    [CaseStatus.Reviewed]: "Reviewed",
    [CaseStatus.Escalated]: "Escalated"
  };
  const confidenceLabels: Record<ConfidenceBand, string> = {
    [ConfidenceBand.High]: "High",
    [ConfidenceBand.Medium]: "Medium",
    [ConfidenceBand.Low]: "Low"
  };

  const {
    statuses,
    confidenceBands,
    vendorSearch,
    reviewedOnly,
    startDate,
    endDate,
    recommendedAction,
    hasBookingEntry,
    setStatuses,
    setConfidenceBands,
    toggleStatus,
    toggleConfidence,
    setVendorSearch,
    setReviewedOnly,
    setStartDate,
    setEndDate,
    setRecommendedAction,
    setHasBookingEntry,
    resetFilters
  } = useInboxFiltersStore();

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["cases"],
    queryFn: () => dataProvider.getCases()
  });

  const uniqueData = useMemo(() => {
    const seen = new Set<string>();
    return data.filter((row) => {
      if (seen.has(row.caseId)) {
        return false;
      }
      seen.add(row.caseId);
      return true;
    });
  }, [data]);

  useEffect(() => {
    if (error) {
      if (!hasErrorToasted.current) {
        addToast({ message: "Unable to load cases. Refresh to retry.", type: "error" });
        hasErrorToasted.current = true;
      }
    } else {
      hasErrorToasted.current = false;
    }
  }, [error, addToast]);

  const recommendationsByCase = useMemo(() => {
    const map = new Map<
      string,
      { title: string; nextStep: string; hasEntry: boolean }
    >();
    data.forEach((row) => {
      const rec = getPrimaryRecommendation({ caseId: row.caseId, transaction: row });
      if (!rec) {
        return;
      }
      map.set(row.caseId, {
        title: rec.title,
        nextStep: rec.title,
        hasEntry: Boolean(rec.bookingEntry)
      });
    });
    return map;
  }, [data]);

  const recommendationOptions = useMemo(() => {
    const options = new Set<string>();
    recommendationsByCase.forEach((rec) => options.add(rec.title));
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [recommendationsByCase]);

  const applyQuickFocus = (nextStatuses: CaseStatus[], nextBands: ConfidenceBand[]) => {
    setStatuses(nextStatuses);
    setConfidenceBands(nextBands);
    setVendorSearch("");
    setReviewedOnly(false);
    setStartDate("");
    setEndDate("");
    setRecommendedAction("all");
    setHasBookingEntry("all");
    setFiltersOpen(true);
  };

  const isHighConfidence = (score: number) => score >= 0.82;
  const isMediumConfidence = (score: number) => score >= 0.65 && score < 0.82;
  const deriveConfidenceBand = (score: number) => {
    if (isHighConfidence(score)) {
      return ConfidenceBand.High;
    }
    if (isMediumConfidence(score)) {
      return ConfidenceBand.Medium;
    }
    return ConfidenceBand.Low;
  };
  const getRowConfidenceBand = (row: TransactionRow) =>
    row.confidenceBand ?? deriveConfidenceBand(row.confidenceScore);
  const matchesConfidenceBand = (row: TransactionRow) => {
    if (confidenceBands.length === 0) {
      return false;
    }
    return confidenceBands.includes(getRowConfidenceBand(row));
  };

  const filteredCases = useMemo(() => {
    const normalizedSearch = vendorSearch.trim().toLowerCase();
    const hasStatusFilters = statuses.length > 0;
    const hasConfidenceFilters = confidenceBands.length > 0;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    return measureDev("inbox filter cases", () =>
      uniqueData.filter((row) => {
        if (hasStatusFilters && !statuses.includes(row.status)) {
          return false;
        }
        if (hasConfidenceFilters && !matchesConfidenceBand(row)) {
          return false;
        }
        if (reviewedOnly && !row.reviewed) {
          return false;
        }
        if (normalizedSearch && !row.vendor.toLowerCase().includes(normalizedSearch)) {
          return false;
        }
        if (recommendedAction !== "all") {
          const rec = recommendationsByCase.get(row.caseId);
          if (!rec || rec.title !== recommendedAction) {
            return false;
          }
        }
        if (hasBookingEntry !== "all") {
          const rec = recommendationsByCase.get(row.caseId);
          const hasEntry = rec?.hasEntry ?? false;
          if (hasBookingEntry === "yes" && !hasEntry) {
            return false;
          }
          if (hasBookingEntry === "no" && hasEntry) {
            return false;
          }
        }
        if (start || end) {
          const postingDate = new Date(row.postingDate);
          if (Number.isNaN(postingDate.getTime())) {
            return false;
          }
          if (start && postingDate < start) {
            return false;
          }
          if (end) {
            const endOfDay = new Date(end);
            endOfDay.setHours(23, 59, 59, 999);
            if (postingDate > endOfDay) {
              return false;
            }
          }
        }
        return true;
      })
      .sort((a, b) => {
        const aTime = new Date(a.lastUpdated ?? a.postingDate).getTime();
        const bTime = new Date(b.lastUpdated ?? b.postingDate).getTime();
        return bTime - aTime;
      })
    );
  }, [
    uniqueData,
    statuses,
    confidenceBands,
    reviewedOnly,
    vendorSearch,
    startDate,
    endDate,
    recommendedAction,
    hasBookingEntry,
    recommendationsByCase
  ]);

  const hasAllStatuses =
    statuses.length === defaultStatuses.length &&
    defaultStatuses.every((status) => statuses.includes(status));
  const hasAllConfidence =
    confidenceBands.length === defaultConfidenceBands.length &&
    defaultConfidenceBands.every((band) => confidenceBands.includes(band));
  const hasActiveFilters =
    vendorSearch.trim().length > 0 ||
    reviewedOnly ||
    Boolean(startDate || endDate) ||
    recommendedAction !== "all" ||
    hasBookingEntry !== "all" ||
    !hasAllStatuses ||
    !hasAllConfidence;

  const highConfidenceOpenCount = useMemo(() => {
    return measureDev(
      "inbox high-confidence count",
      () =>
        uniqueData.filter(
          (row) =>
            row.status === CaseStatus.ScreenedUnresolved &&
            getRowConfidenceBand(row) === ConfidenceBand.High
        ).length
    );
  }, [uniqueData]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inbox</h1>
          <p className="text-sm text-slate-600">Queue of cases to review.</p>
          <p className="text-sm text-slate-600">Pick next case to resolve or escalate.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold uppercase tracking-wide text-slate-500">
              Quick focus
            </span>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() =>
                applyQuickFocus(
                  [CaseStatus.ScreenedUnresolved],
                  [ConfidenceBand.High]
                )
              }
            >
              High confidence open
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() =>
                applyQuickFocus(
                  [CaseStatus.Escalated],
                  [ConfidenceBand.High, ConfidenceBand.Medium, ConfidenceBand.Low]
                )
              }
            >
              Escalated
            </button>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => setFiltersOpen((prev) => !prev)}
          aria-expanded={filtersOpen}
          aria-controls="inbox-filter-panel"
        >
          Filters
          <span className="text-xs text-slate-500">{filtersOpen ? "Hide" : "Show"}</span>
        </button>
      </header>

      {filtersOpen && (
        <section
          id="inbox-filter-panel"
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </h2>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {[
                    CaseStatus.ScreenedUnresolved,
                    CaseStatus.Resolved,
                    CaseStatus.Reviewed,
                    CaseStatus.Escalated
                  ].map((status) => (
                    <label key={status} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={statuses.includes(status)}
                        onChange={() => toggleStatus(status)}
                      />
                      <span>{statusLabels[status]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Confidence
                  <InfoTooltip
                    label="Confidence definition"
                    text="AI certainty in the match."
                  />
                </h2>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {[ConfidenceBand.High, ConfidenceBand.Medium, ConfidenceBand.Low].map((band) => (
                    <label key={band} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={confidenceBands.includes(band)}
                        onChange={() => toggleConfidence(band)}
                      />
                      <span>{confidenceLabels[band]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vendor
                </h2>
                <input
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Search vendor"
                  value={vendorSearch}
                  onChange={(event) => setVendorSearch(event.target.value)}
                />
              </div>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recommended Action
                </h2>
                <select
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  value={recommendedAction}
                  onChange={(event) => setRecommendedAction(event.target.value)}
                >
                  <option value="all">All actions</option>
                  {recommendationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date Range
                </h2>
                <div className="mt-2 flex flex-col gap-2">
                  <input
                    type="date"
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    aria-label="Start date"
                  />
                  <input
                    type="date"
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    aria-label="End date"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Has booking entry
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  value={hasBookingEntry}
                  onChange={(event) =>
                    setHasBookingEntry(event.target.value as "all" | "yes" | "no")
                  }
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reviewedOnly}
                  onChange={(event) => setReviewedOnly(event.target.checked)}
                />
                <span>Reviewed only</span>
              </label>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={resetFilters}
              >
                Reset filters
              </button>
            </div>
          </div>
        </section>
      )}

      <section
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600"
        aria-live="polite"
      >
        <div>
          <span className="font-semibold text-slate-900">{filteredCases.length}</span>{" "}
          of <span className="font-semibold text-slate-900">{uniqueData.length}</span> cases
          {hasActiveFilters ? " match the current filters." : " in the queue."}
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={resetFilters}
          >
            Clear filters
          </button>
        ) : null}
      </section>

      {highConfidenceOpenCount > 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <span>
            {highConfidenceOpenCount} high-confidence open cases can be resolved
            now.
          </span>
          <button
            type="button"
            className="rounded-md border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
            onClick={() =>
              applyQuickFocus(
                [CaseStatus.ScreenedUnresolved],
                [ConfidenceBand.High]
              )
            }
          >
            Show cases
          </button>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Inbox cases</caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3">Case</th>
              <th scope="col" className="px-4 py-3">Vendor</th>
              <th scope="col" className="px-4 py-3">Amount</th>
              <th scope="col" className="px-4 py-3">
                <span className="flex items-center gap-2">
                  Variance
                  <InfoTooltip
                    label="Variance definition"
                    text="Difference between expected and actual amount."
                  />
                </span>
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="flex items-center gap-2">
                  Confidence
                  <InfoTooltip
                    label="Confidence definition"
                    text="AI certainty in the match."
                  />
                </span>
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="flex items-center gap-2">
                  AI Reason
                  <InfoTooltip
                    label="AI Reason definition"
                    text="AI's likely root cause for the variance."
                  />
                </span>
              </th>
              <th scope="col" className="px-4 py-3">Next step</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3 text-right">
                <span className="flex items-center justify-end gap-2">
                  Close
                  <InfoTooltip
                    label="Close case helper"
                    text="Closing requires a rationale and attached evidence on the case page; it does not post any entry."
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <SkeletonTable rows={6} columns={9} />
            ) : error ? (
              <tr>
                <td colSpan={9} className="px-4 py-6">
                  <ErrorState
                    title="Unable to load cases"
                    message="Refresh the page to retry loading inbox data."
                    onRetry={() => void refetch()}
                  />
                </td>
              </tr>
            ) : filteredCases.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6">
                  <EmptyState
                    title="No cases found"
                    subtitle="Reset filters to see cases."
                    actionLabel="Reset filters"
                    onAction={resetFilters}
                  />
                </td>
              </tr>
            ) : (
              filteredCases.map((row) => {
                const rowBand = getRowConfidenceBand(row);
                const showQuickResolve =
                  rowBand === ConfidenceBand.High &&
                  row.status === CaseStatus.ScreenedUnresolved;
                return (
                  <tr key={row.caseId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link
                        to={`/cases/${row.caseId}`}
                        className="text-slate-900 underline-offset-4 hover:underline"
                      >
                        {row.caseId}
                      </Link>
                      <div className="text-xs text-slate-500">{row.transactionId}</div>
                    </td>
                    <td className="px-4 py-3">{row.vendor}</td>
                    <td className="px-4 py-3">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.variance)}</td>
                    <td className="px-4 py-3">
                      <ConfidencePill band={rowBand} score={row.confidenceScore} />
                    </td>
                    <td className="px-4 py-3">{getRootCauseLabel(row)}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-slate-900">
                        {recommendationsByCase.get(row.caseId)?.nextStep ?? "Review case"}
                      </div>
                      {recommendationsByCase.get(row.caseId)?.hasEntry ? (
                        <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          Entry
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {showQuickResolve ? (
                        <div className="flex flex-col items-end gap-1">
                          <Link
                            to={`/cases/${row.caseId}?decision=CLOSE_AS_RESOLVED`}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                          >
                            Review to close
                          </Link>
                          <span className="text-[10px] text-slate-500">
                            Needs rationale and evidence; no auto-post.
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
