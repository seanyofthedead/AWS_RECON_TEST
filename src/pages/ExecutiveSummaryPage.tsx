import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider } from "../hooks/useDataProvider";
import { CaseStatus } from "../types/case";
import { KpiCard } from "../components/KpiCard";
import { SimpleBarChart } from "../components/SimpleBarChart";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { InfoTooltip } from "../components/InfoTooltip";
import { getRootCauseLabel } from "../utils/rootCause";
import { getAnalystName, getAnalystOptions } from "../utils/analyst";
import { measureDev } from "../utils/perf";
import { useRoutePerf } from "../hooks/useRoutePerf";
import { getPrimaryRecommendation } from "../utils/recommendations";
import { useInboxFiltersStore } from "../store/useInboxFiltersStore";
import { BatchImportWorkflow } from "../components/BatchImportWorkflow";
import { formatCurrency } from "../utils/formatCurrency";

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: CaseStatus.ScreenedUnresolved, label: "Open (in queue)" },
  { value: CaseStatus.Reviewed, label: "Reviewed" },
  { value: CaseStatus.Resolved, label: "Resolved" },
  { value: CaseStatus.Escalated, label: "Escalated" }
];

const varianceBuckets = [
  { label: "$0 - $1k", min: 0, max: 1000 },
  { label: "$1k - $10k", min: 1000, max: 10000 },
  { label: "$10k - $50k", min: 10000, max: 50000 },
  { label: "$50k+", min: 50000 }
];
const BATCH_COUNTER_KEY = "recon_batch_counter_v1";

const formatNumber = (value: number) => value.toLocaleString();

export const ExecutiveSummaryPage = () => {
  useRoutePerf("Executive Summary");
  const dataProvider = useDataProvider();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setRecommendedAction = useInboxFiltersStore((state) => state.setRecommendedAction);
  const setHasBookingEntry = useInboxFiltersStore((state) => state.setHasBookingEntry);
  const resetInboxFilters = useInboxFiltersStore((state) => state.resetFilters);
  const [threshold, setThreshold] = useState(5);
  const [vendorFilter, setVendorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [analystFilter, setAnalystFilter] = useState("all");
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [runId, setRunId] = useState(0);
  const [inlineSuccessMessage, setInlineSuccessMessage] = useState<string | null>(null);
  const [lastImportCount, setLastImportCount] = useState<number | null>(null);
  const [showAllRootCauses, setShowAllRootCauses] = useState(false);
  const lastHandledRunIdRef = useRef<number | null>(null);

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["cases"],
    queryFn: () => dataProvider.getCases()
  });

  const vendors = useMemo(() => {
    const unique = new Set<string>();
    data.forEach((row) => unique.add(row.vendor));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const resetFilters = () => {
    setThreshold(5);
    setVendorFilter("all");
    setStatusFilter("all");
    setAnalystFilter("all");
  };

  const hasActiveFilters =
    threshold !== 5 || vendorFilter !== "all" || statusFilter !== "all" || analystFilter !== "all";

  const focusStatus = (nextStatus: string) => {
    setStatusFilter(nextStatus);
    setVendorFilter("all");
    setAnalystFilter("all");
  };

  const filteredRows = useMemo(() => {
    return measureDev("executive filter cases", () =>
      data.filter((row) => {
      if (vendorFilter !== "all" && row.vendor !== vendorFilter) {
        return false;
      }
      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }
      if (analystFilter !== "all" && getAnalystName(row.caseId) !== analystFilter) {
        return false;
      }
        return true;
      })
    );
  }, [data, vendorFilter, statusFilter, analystFilter]);

  const metrics = useMemo(() => {
    return measureDev("executive metrics", () => {
      const totals = {
      total: filteredRows.length,
      open: 0,
      reviewed: 0,
      resolved: 0,
      escalated: 0
    };
    const policy = { within: 0, above: 0 };
    const varianceCounts = varianceBuckets.map((bucket) => ({ ...bucket, count: 0 }));
    const rootCauseCounts = new Map<string, number>();

    filteredRows.forEach((row) => {
      if (row.status === CaseStatus.ScreenedUnresolved) {
        totals.open += 1;
      } else if (row.status === CaseStatus.Reviewed) {
        totals.reviewed += 1;
      } else if (row.status === CaseStatus.Resolved) {
        totals.resolved += 1;
      } else if (row.status === CaseStatus.Escalated) {
        totals.escalated += 1;
      }

      const absVariance = Math.abs(row.variance);
      const amountBasis = Math.abs(row.amount);
      const variancePercent = amountBasis > 0 ? (absVariance / amountBasis) * 100 : 0;
      if (variancePercent > threshold) {
        policy.above += 1;
      } else {
        policy.within += 1;
      }

      const bucket = varianceCounts.find((entry) =>
        entry.max === undefined
          ? absVariance >= entry.min
          : absVariance >= entry.min && absVariance < entry.max
      );
      if (bucket) {
        bucket.count += 1;
      }

      const reason = getRootCauseLabel(row);
      rootCauseCounts.set(reason, (rootCauseCounts.get(reason) ?? 0) + 1);
    });

    const processed = totals.reviewed + totals.resolved + totals.escalated;
    const processedPercent = totals.total > 0 ? (processed / totals.total) * 100 : 0;

      return {
        totals,
        processed,
        processedPercent,
        policy,
        varianceCounts,
        rootCauseCounts
      };
    });
  }, [filteredRows, threshold]);

  const statusChartItems = useMemo(() => {
    const total = metrics.totals.total || 1;
    return [
      {
        label: "Open (in queue)",
        value: metrics.totals.open,
        percentage: (metrics.totals.open / total) * 100,
        colorClass: "bg-slate-500"
      },
      {
        label: "Reviewed",
        value: metrics.totals.reviewed,
        percentage: (metrics.totals.reviewed / total) * 100,
        colorClass: "bg-sky-500"
      },
      {
        label: "Resolved",
        value: metrics.totals.resolved,
        percentage: (metrics.totals.resolved / total) * 100,
        colorClass: "bg-emerald-500"
      },
      {
        label: "Escalated",
        value: metrics.totals.escalated,
        percentage: (metrics.totals.escalated / total) * 100,
        colorClass: "bg-rose-500"
      }
    ];
  }, [metrics]);

  const policyChartItems = useMemo(() => {
    const total = metrics.totals.total || 1;
    return [
      {
        label: "Within policy",
        value: metrics.policy.within,
        percentage: (metrics.policy.within / total) * 100,
        colorClass: "bg-emerald-500"
      },
      {
        label: "Above threshold",
        value: metrics.policy.above,
        percentage: (metrics.policy.above / total) * 100,
        colorClass: "bg-amber-500"
      }
    ];
  }, [metrics]);

  const varianceChartItems = useMemo(() => {
    const total = metrics.totals.total || 1;
    return metrics.varianceCounts.map((bucket, index) => ({
      label: bucket.label,
      value: bucket.count,
      percentage: (bucket.count / total) * 100,
      colorClass: index % 2 === 0 ? "bg-indigo-500" : "bg-indigo-300"
    }));
  }, [metrics]);

  const rootCauseItemsAll = useMemo(() => {
    const total = metrics.totals.total || 1;
    const palette = [
      "bg-violet-700",
      "bg-violet-600",
      "bg-violet-500",
      "bg-violet-400",
      "bg-violet-300",
      "bg-violet-200"
    ];
    const entries = Array.from(metrics.rootCauseCounts.entries())
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]);
    const lastIndex = Math.max(entries.length - 1, 1);
    return entries.map(([label, value], index) => {
      const shadeIndex = Math.round((index / lastIndex) * (palette.length - 1));
      return {
        label,
        value,
        percentage: (value / total) * 100,
        colorClass: palette[shadeIndex]
      };
    });
  }, [metrics]);
  const rootCauseItemsCollapsed = useMemo(
    () => rootCauseItemsAll.slice(0, 5),
    [rootCauseItemsAll]
  );
  const rootCauseItemsShown = showAllRootCauses
    ? rootCauseItemsAll
    : rootCauseItemsCollapsed;
  const remainingRootCauseCount = Math.max(
    rootCauseItemsAll.length - rootCauseItemsCollapsed.length,
    0
  );

  const topVariances = useMemo(() => {
    return measureDev("executive top variances", () =>
      [...filteredRows]
        .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
        .slice(0, 6)
    );
  }, [filteredRows]);

  const vendorsNeedingReview = useMemo(() => {
    return measureDev("executive vendor rollup", () => {
      const byVendor = new Map<
        string,
        { vendor: string; above: number; total: number }
      >();
      filteredRows.forEach((row) => {
        const record = byVendor.get(row.vendor) ?? {
          vendor: row.vendor,
          above: 0,
          total: 0
        };
        record.total += 1;
        const absAmount = Math.abs(row.amount);
        const percentVariance =
          absAmount > 0 ? (Math.abs(row.variance) / absAmount) * 100 : 0;
        if (percentVariance > threshold) {
          record.above += 1;
        }
        byVendor.set(row.vendor, record);
      });
      return Array.from(byVendor.values())
        .filter((entry) => entry.above > 0)
        .sort((a, b) => b.above - a.above)
        .slice(0, 6);
    });
  }, [filteredRows, threshold]);

  const recommendationRollup = useMemo(() => {
    return measureDev("executive recommendations", () => {
      const counts = new Map<string, number>();
      let withEntry = 0;
      filteredRows.forEach((row) => {
        const rec = getPrimaryRecommendation({ caseId: row.caseId, transaction: row });
        counts.set(rec.title, (counts.get(rec.title) ?? 0) + 1);
        if (rec.bookingEntry) {
          withEntry += 1;
        }
      });
      const topActions = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([title, count]) => ({ title, count }));
      return { topActions, withEntry };
    });
  }, [filteredRows]);

  const goToInboxWithAction = (action: string) => {
    resetInboxFilters();
    setRecommendedAction(action);
    navigate("/inbox");
  };

  const goToInboxWithBookingEntries = () => {
    resetInboxFilters();
    setHasBookingEntry("yes");
    navigate("/inbox");
  };

  const getNextBatchId = () => {
    localStorage.setItem(BATCH_COUNTER_KEY, "1");
    return 1;
  };

  const handleStartImport = async () => {
    const nextId = getNextBatchId();
    setBatchId(nextId);
    setInlineSuccessMessage(null);
    setLastImportCount(null);
    setIsImporting(true);
    const result = await dataProvider.importNextBatch(nextId);
    const importedCount = result.importedCount;
    setLastImportCount(importedCount);
    setInlineSuccessMessage(
      importedCount > 0
        ? `Imported ${importedCount} new cases.`
        : "No new cases—batch already imported."
    );
    void queryClient.invalidateQueries({ queryKey: ["cases"] });
    if (importedCount > 0) {
      setRunId((prev) => prev + 1);
      setIsWorkflowOpen(true);
    } else {
      setIsImporting(false);
    }
  };

  const handleWorkflowClose = () => {
    setIsWorkflowOpen(false);
    setIsImporting(false);
  };

  const handleWorkflowComplete = () => {
    if (lastHandledRunIdRef.current === runId) {
      return;
    }
    lastHandledRunIdRef.current = runId;
    setIsWorkflowOpen(false);
    setIsImporting(false);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Executive Summary</h1>
          <p className="text-sm text-slate-600">
            A focused snapshot of variance risk, review volume, and the evidence that
            supports each recommendation.
          </p>
          <p className="text-sm text-slate-600">Filter to find cases needing review.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={handleStartImport}
            disabled={isImporting}
          >
            {isImporting ? (
              <>
                <span
                  className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-white"
                  aria-hidden="true"
                />
                Importing…
              </>
            ) : (
              "Import Next Batch"
            )}
          </button>
          {inlineSuccessMessage ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
              <span>{inlineSuccessMessage}</span>
              <button
                type="button"
                className="rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-900 hover:bg-emerald-100"
                onClick={() => setInlineSuccessMessage(null)}
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <BatchImportWorkflow
        open={isWorkflowOpen}
        batchId={batchId ?? 1}
        runId={runId}
        onClose={handleWorkflowClose}
        onComplete={handleWorkflowComplete}
        importedCount={lastImportCount}
        onViewInbox={() => navigate("/inbox")}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span className="flex items-center gap-2">
              Variance threshold (%)
              <InfoTooltip
                label="Threshold definition"
                text="Percent variance that triggers review."
              />
            </span>
            <input
              type="number"
              min={0}
              className="w-40 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
              value={threshold}
              placeholder="5"
              onChange={(event) => {
                const next = Number(event.target.value);
                setThreshold(Number.isFinite(next) ? next : 0);
              }}
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vendor
            <select
              className="w-56 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
              value={vendorFilter}
              onChange={(event) => setVendorFilter(event.target.value)}
            >
              <option value="all">All vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              className="w-48 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Analyst
            <select
              className="w-48 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
              value={analystFilter}
              onChange={(event) => setAnalystFilter(event.target.value)}
            >
              <option value="all">All analysts</option>
              {getAnalystOptions().map((analyst) => (
                <option key={analyst} value={analyst}>
                  {analyst}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-500">
            Quick focus
          </span>
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => focusStatus(CaseStatus.ScreenedUnresolved)}
          >
            Open queue
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => focusStatus(CaseStatus.Escalated)}
          >
            Escalated
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            Showing <span className="font-semibold text-slate-900">{filteredRows.length}</span>{" "}
            of <span className="font-semibold text-slate-900">{data.length}</span> cases.
          </span>
          {hasActiveFilters ? (
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
              onClick={resetFilters}
            >
              Reset filters
            </button>
          ) : null}
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading executive summary...
        </div>
      ) : error ? (
        <ErrorState
          title="Unable to load summary data"
          message="Refresh the page to retry loading executive data."
          onRetry={() => void refetch()}
        />
      ) : data.length === 0 ? (
        <EmptyState
          title="No data available"
          subtitle="Load transactions to view the executive summary."
        />
      ) : (
        <>
          {filteredRows.length === 0 ? (
            <EmptyState
              title="No cases match these filters"
              subtitle="Reset filters to see all cases."
              actionLabel="Reset filters"
              onAction={resetFilters}
            />
          ) : (
            <>
              {metrics.policy.above > 0 ? (
                <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <span>
                    {formatNumber(metrics.policy.above)} cases exceed the threshold.
                    Review them in Inbox.
                  </span>
                  <Link
                    to="/inbox"
                    className="rounded-md border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    View Inbox
                  </Link>
                </section>
              ) : null}

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <KpiCard label="Total cases" value={formatNumber(metrics.totals.total)} />
                <KpiCard label="Open (in queue)" value={formatNumber(metrics.totals.open)} />
                <KpiCard label="Reviewed" value={formatNumber(metrics.totals.reviewed)} />
                <KpiCard label="Resolved" value={formatNumber(metrics.totals.resolved)} />
                <KpiCard label="Escalated" value={formatNumber(metrics.totals.escalated)} />
                <KpiCard
                  label="Processed to-date"
                  value={formatNumber(metrics.processed)}
                  helperText={`${metrics.processedPercent.toFixed(1)}% completed`}
                />
              </section>

              <section className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Top recommended actions
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {recommendationRollup.topActions.length === 0 ? (
                      <li className="text-xs text-slate-500">No actions available.</li>
                    ) : (
                      recommendationRollup.topActions.map((action) => (
                        <li key={action.title} className="flex items-center justify-between">
                          <button
                            type="button"
                            className="text-left text-sm font-semibold text-slate-900 hover:underline"
                            onClick={() => goToInboxWithAction(action.title)}
                          >
                            {action.title}
                          </button>
                          <span className="text-xs text-slate-500">
                            {formatNumber(action.count)}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Cases with booking entries
                  </h3>
                  <div className="mt-3 text-2xl font-semibold text-slate-900">
                    {formatNumber(recommendationRollup.withEntry)}
                  </div>
                  <button
                    type="button"
                    className="mt-3 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={goToInboxWithBookingEntries}
                  >
                    Filter in Inbox
                  </button>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-3">
                <SimpleBarChart title="Status distribution" items={statusChartItems} />
                <SimpleBarChart
                  title={
                    <span className="flex items-center gap-2">
                      Policy check
                      <InfoTooltip
                        label="Within policy definition"
                        text="Within policy means variance at or below threshold."
                      />
                    </span>
                  }
                  items={policyChartItems}
                />
                <SimpleBarChart
                  title="Variance magnitude distribution"
                  items={varianceChartItems}
                />
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <SimpleBarChart
                  title={
                    <div className="flex items-center justify-between gap-3">
                      <span>Root cause rollup</span>
                      {remainingRootCauseCount > 0 ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                          onClick={() => setShowAllRootCauses((prev) => !prev)}
                          aria-expanded={showAllRootCauses}
                        >
                          {showAllRootCauses
                            ? "Show Less"
                            : `Show All (${remainingRootCauseCount})`}
                        </button>
                      ) : null}
                    </div>
                  }
                  items={rootCauseItemsShown}
                />
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Top variances</h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">Top variances by case</caption>
                      <thead className="text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th scope="col" className="pb-2 pr-4">Case</th>
                          <th scope="col" className="pb-2 pr-4">Vendor</th>
                          <th scope="col" className="pb-2 pr-4">Variance</th>
                          <th scope="col" className="pb-2 pr-4">Status</th>
                          <th scope="col" className="pb-2">
                            <span className="flex items-center gap-2">
                              AI Reason
                              <InfoTooltip
                                label="AI Reason definition"
                                text="AI's likely root cause for the variance."
                              />
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {topVariances.map((row) => (
                          <tr key={row.caseId} className="hover:bg-slate-50">
                            <td className="py-2 pr-4 font-medium text-slate-900">
                              <Link
                                to={`/cases/${row.caseId}`}
                                className="text-slate-900 underline-offset-4 hover:underline"
                              >
                                {row.caseId}
                              </Link>
                              <div className="text-xs text-slate-500">
                                {row.transactionId}
                              </div>
                            </td>
                            <td className="py-2 pr-4">{row.vendor}</td>
                            <td className="py-2 pr-4">{formatCurrency(row.variance)}</td>
                            <td className="py-2 pr-4">
                              <StatusPill status={row.status} />
                            </td>
                            <td className="py-2">{getRootCauseLabel(row)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Vendors requiring review
                </h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Vendors requiring review</caption>
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="pb-2 pr-4">Vendor</th>
                        <th scope="col" className="pb-2 pr-4">Above threshold</th>
                        <th scope="col" className="pb-2">Total cases</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendorsNeedingReview.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="py-6 text-center text-sm text-slate-500"
                          >
                            No vendors exceed the current threshold.
                          </td>
                        </tr>
                      ) : (
                        vendorsNeedingReview.map((vendor) => (
                          <tr key={vendor.vendor}>
                            <td className="py-2 pr-4 font-medium text-slate-900">
                              {vendor.vendor}
                            </td>
                            <td className="py-2 pr-4">{formatNumber(vendor.above)}</td>
                            <td className="py-2">{formatNumber(vendor.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};
