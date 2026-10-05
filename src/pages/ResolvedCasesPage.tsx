import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "../hooks/useDataProvider";
import { ConfidencePill } from "../components/ConfidencePill";
import { SkeletonTable } from "../components/SkeletonTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { InfoTooltip } from "../components/InfoTooltip";
import { CaseStatus } from "../types/case";
import { useRoutePerf } from "../hooks/useRoutePerf";
import { describeClosure } from "../utils/closurePolicy";

export const ResolvedCasesPage = () => {
  useRoutePerf("Resolved");
  const dataProvider = useDataProvider();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showRecentOnly, setShowRecentOnly] = useState(false);

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["cases"],
    queryFn: () => dataProvider.getCases()
  });

  const resolvedCases = useMemo(
    () => data.filter((row) => row.status === CaseStatus.Resolved),
    [data]
  );

  const recentResolvedCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return resolvedCases.filter((row) => {
      const resolvedDate = new Date(row.resolvedAt ?? row.lastUpdated ?? row.postingDate);
      return !Number.isNaN(resolvedDate.getTime()) && resolvedDate.getTime() >= cutoff;
    }).length;
  }, [resolvedCases]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return resolvedCases.filter((row) => {
      if (showRecentOnly) {
        const resolvedDate = new Date(row.resolvedAt ?? row.lastUpdated ?? row.postingDate);
        if (Number.isNaN(resolvedDate.getTime()) || resolvedDate.getTime() < cutoff) {
          return false;
        }
      }
      if (!normalizedSearch) {
        return true;
      }
      return (
        row.vendor.toLowerCase().includes(normalizedSearch) ||
        row.transactionId.toLowerCase().includes(normalizedSearch) ||
        row.caseId.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [resolvedCases, search, showRecentOnly]);

  const hasActiveFilters = search.trim().length > 0 || showRecentOnly;

  const resetView = () => {
    setSearch("");
    setShowRecentOnly(false);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Resolved</h1>
        <p className="text-sm text-slate-600">Closed cases and outcomes.</p>
        <p className="text-sm text-slate-600">Search by vendor, case, or date.</p>
      </header>

      {recentResolvedCount > 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <span>Resolved in last 7 days: {recentResolvedCount}.</span>
          <button
            type="button"
            className="rounded-md border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-100"
            onClick={() => setShowRecentOnly(true)}
          >
            Show recent
          </button>
        </section>
      ) : null}

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <label className="flex flex-1 flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Quick search
          <input
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            placeholder="Search vendor, case, or transaction"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search resolved cases"
          />
        </label>
        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => setShowRecentOnly((prev) => !prev)}
        >
          {showRecentOnly ? "All dates" : "Last 7 days"}
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          onClick={resetView}
        >
          Reset view
        </button>
      </section>

      <section
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600"
        aria-live="polite"
      >
        <div>
          <span className="font-semibold text-slate-900">{filteredCases.length}</span>{" "}
          of <span className="font-semibold text-slate-900">{resolvedCases.length}</span>{" "}
          resolved cases
          {hasActiveFilters ? " match this view." : "."}
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={resetView}
          >
            Clear filters
          </button>
        ) : null}
      </section>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Resolved cases</caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3">Transaction ID</th>
              <th scope="col" className="px-4 py-3">Vendor</th>
              <th scope="col" className="px-4 py-3">
                <span className="flex items-center gap-2">
                  Resolution
                  <InfoTooltip
                    label="Resolution definition"
                    text="Recorded closure disposition. Seeded demo closures come from fixture data; analyst closures saved before dispositions were tracked have none recorded."
                  />
                </span>
              </th>
              <th scope="col" className="px-4 py-3">Confidence</th>
              <th scope="col" className="px-4 py-3">
                <span className="flex items-center gap-2">
                  Closed at
                  <InfoTooltip
                    label="Closed at definition"
                    text="Time the case was resolved."
                  />
                </span>
              </th>
              <th scope="col" className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <SkeletonTable rows={6} columns={6} />
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-6">
                  <ErrorState
                    title="Unable to load resolved cases"
                    message="Refresh the page to retry loading resolved cases."
                    onRetry={() => void refetch()}
                  />
                </td>
              </tr>
            ) : filteredCases.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6">
                  <EmptyState
                    title="No resolved cases yet"
                    subtitle="Review cases in Inbox to build history."
                    actionLabel="Go to Inbox"
                    onAction={() => navigate("/inbox")}
                  />
                </td>
              </tr>
            ) : (
              filteredCases.map((row) => (
                <tr key={row.caseId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.transactionId}
                    <div className="text-xs text-slate-500">{row.caseId}</div>
                  </td>
                  <td className="px-4 py-3">{row.vendor}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold text-emerald-700">
                      {describeClosure(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ConfidencePill band={row.confidenceBand} score={row.confidenceScore} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(row.resolvedAt ?? row.lastUpdated ?? row.postingDate).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/cases/${row.caseId}`}
                      className="text-xs font-semibold text-slate-700 underline-offset-4 hover:underline"
                    >
                      View Case
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
