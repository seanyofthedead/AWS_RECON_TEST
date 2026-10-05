import { useState } from "react";
import { useEnvStore } from "../store/env";
import { InfoTooltip } from "../components/InfoTooltip";
import { useRoutePerf } from "../hooks/useRoutePerf";
import { ConfirmModal } from "../components/ConfirmModal";
import { useToastStore } from "../store/useToastStore";
import { resetDemoState } from "../utils/resetDemoState";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "../hooks/useDataProvider";
import { formatCurrency } from "../utils/formatCurrency";

export const SettingsPage = () => {
  useRoutePerf("Settings");
  const provider = useEnvStore((state) => state.provider);
  const setProvider = useEnvStore((state) => state.setProvider);
  const addToast = useToastStore((state) => state.addToast);
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const dataProvider = useDataProvider();
  const { data: ingestionReports, error: ingestionError } = useQuery({
    queryKey: ["ingestion-report"],
    queryFn: async () => {
      await dataProvider.getCases();
      return dataProvider.listIngestionReports();
    }
  });

  const handleResetConfirm = () => {
    if (isResetting) {
      return;
    }
    setIsResetting(true);
    resetDemoState();
    addToast({ message: "Demo state reset. Reloading…", type: "success" });
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">Control data sources and behavior.</p>
        <p className="text-sm text-slate-600">Use defaults unless testing.</p>
      </header>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Changes apply across all tabs. Refresh to reload data.
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          Data provider
          <InfoTooltip
            label="Data provider definition"
            text="Selects where case data comes from."
          />
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Choose the data source for cases and escalations.
        </p>
        <div className="mt-4 space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="provider"
              value="mock"
              checked={provider === "mock"}
              onChange={() => setProvider("mock")}
            />
            <span>Mock provider (in-browser CSV)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="provider"
              value="api"
              checked={provider === "api"}
              disabled
            />
            <span className="text-slate-400">
              API provider (backend HTTP API) — not available in this build
            </span>
          </label>
          <p className="text-xs text-slate-500">
            This build includes only the mock provider, so all cases are demo fixtures. Cognito
            sign-in is live; business data is not.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Reset demo state</h2>
        <p className="mt-2 text-sm text-slate-600">
          Clears demo decisions, imported batches, and filters saved in this browser.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => setResetOpen(true)}
        >
          Reset demo state
        </button>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          Data load report
          <InfoTooltip
            label="Data load report"
            text="Rows that fail validation are rejected with reasons, not repaired; duplicate transaction IDs are exceptions. Source totals reconcile to accepted, rejected, and duplicate rows."
          />
        </h2>
        {ingestionError ? (
          <p className="mt-2 text-rose-800">
            Data could not be loaded: {(ingestionError as Error).message}
          </p>
        ) : ingestionReports ? (
          <div className="mt-2 space-y-3">
            {Object.entries(ingestionReports).map(([source, ingestion]) => (
              <div key={source} className="space-y-1">
                <p>
                  <span className="font-semibold">{source === "baseline" ? "Baseline" : `Imported ${source}`}:</span>{" "}
                  {ingestion.totals.sourceRows} source rows ({formatCurrency(ingestion.totals.sourceAmount)}):{" "}
                  {ingestion.totals.acceptedRows} accepted ({formatCurrency(ingestion.totals.acceptedAmount)}),{" "}
                  {ingestion.totals.rejectedRows} rejected ({formatCurrency(ingestion.totals.rejectedAmount)}),{" "}
                  {ingestion.totals.duplicateRows} duplicates ({formatCurrency(ingestion.totals.duplicateAmount)}).
                  {ingestion.totals.unparseableAmountRows > 0
                    ? ` ${ingestion.totals.unparseableAmountRows} rows had no readable amount.`
                    : ""}
                </p>
                {[
                  ...ingestion.parseErrors,
                  ...ingestion.rejected.map(
                    (row) => `Line ${row.line} (${row.transactionId || "no ID"}): ${row.reasons.join("; ")}`
                  ),
                  ...ingestion.duplicates.map(
                    (row) =>
                      `Line ${row.line} (${row.transactionId}): duplicate of line ${row.firstLine}`
                  )
                ].map((message) => (
                  <p key={message} className="text-xs text-rose-800">
                    {message}
                  </p>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-slate-500">Loading…</p>
        )}
      </section>

      <section className="text-xs text-slate-400">
        Build:{" "}
        {typeof __BUILD_TIMESTAMP__ !== "undefined"
          ? __BUILD_TIMESTAMP__.slice(0, 10)
          : "dev"}
      </section>

      <ConfirmModal
        isOpen={resetOpen}
        title="Reset demo state?"
        bullets={[
          "Removes saved demo decisions, imports, and filters",
          "Safe: no external systems impacted"
        ]}
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={handleResetConfirm}
        onClose={() => {
          if (!isResetting) {
            setResetOpen(false);
          }
        }}
        isConfirming={isResetting}
      />
    </div>
  );
};
