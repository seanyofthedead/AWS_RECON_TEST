import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider } from "../hooks/useDataProvider";
import { StatusPill } from "../components/StatusPill";
import { ConfidencePill } from "../components/ConfidencePill";
import { ClaimsPanel } from "../components/ClaimsPanel";
import { OverrideModal } from "../components/OverrideModal";
import { SkeletonTable } from "../components/SkeletonTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToastStore } from "../store/toastStore";
import { InfoTooltip } from "../components/InfoTooltip";
import { CaseStatus } from "../types/case";
import { ReviewDecisionType } from "../types/review";
import { getRootCauseLabel } from "../utils/rootCause";
import { useRoutePerf } from "../hooks/useRoutePerf";
import { RecommendationCard } from "../components/RecommendationCard";
import { useRecommendations } from "../hooks/useRecommendations";
import {
  attachRecommendationToEscalation,
  formatBookingEntry,
  markRecommendationProposed
} from "../utils/recommendations";
import { formatCurrency } from "../utils/formatCurrency";
import { describeClosure, planEscalateWithFix } from "../utils/closurePolicy";

export const CasePage = () => {
  const { caseId = "" } = useParams();
  useRoutePerf(caseId ? `Case Detail ${caseId}` : "Case Detail");
  const dataProvider = useDataProvider();
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  const { data: caseFile, isLoading, error, refetch } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => dataProvider.getCase(caseId),
    enabled: Boolean(caseId)
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: () => dataProvider.getCases()
  });

  const transaction = useMemo(
    () => cases.find((item) => item.caseId === caseId),
    [cases, caseId]
  );
  const { primary: recommendation, proposedId } = useRecommendations({
    caseId,
    transaction
  });
  const [proposed, setProposed] = useState(proposedId ?? "");

  useEffect(() => {
    setProposed(proposedId ?? "");
  }, [proposedId, caseId]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [caseId]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [decisionModal, setDecisionModal] = useState<ReviewDecisionType | null>(null);
  const [attachOnEscalate, setAttachOnEscalate] = useState(false);

  // Inbox links here with ?decision=... to open the decision form directly.
  useEffect(() => {
    const requested = searchParams.get("decision");
    if (requested === "CLOSE_AS_RESOLVED" || requested === "ESCALATE") {
      setDecisionModal(requested);
      const next = new URLSearchParams(searchParams);
      next.delete("decision");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [tabInitialized, setTabInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "evidence" | "structured" | "conflicts" | "runlog"
  >("evidence");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabOrder = ["evidence", "structured", "conflicts", "runlog"] as const;

  const handleTabKeyDown = (event: KeyboardEvent) => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % tabOrder.length;
      setActiveTab(tabOrder[nextIndex]);
      tabRefs.current[nextIndex]?.focus();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
      setActiveTab(tabOrder[nextIndex]);
      tabRefs.current[nextIndex]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveTab(tabOrder[0]);
      tabRefs.current[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveTab(tabOrder[tabOrder.length - 1]);
      tabRefs.current[tabOrder.length - 1]?.focus();
    }
  };

  useEffect(() => {
    if (error) {
      addToast({ message: "Unable to load case details.", type: "error" });
    }
  }, [error, addToast]);

  useEffect(() => {
    setTabInitialized(false);
  }, [caseId]);

  useEffect(() => {
    if (!caseFile || tabInitialized) {
      return;
    }
    setActiveTab(caseFile.conflicts.length > 0 ? "conflicts" : "evidence");
    setTabInitialized(true);
  }, [caseFile, tabInitialized]);

  if (!caseId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-slate-700">Select a case to review.</p>
      </div>
    );
  }

  if (isLoading || !caseFile) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {error ? (
          <ErrorState
            title="Unable to load case"
            message="Refresh the page to retry loading this case."
            onRetry={() => void refetch()}
          />
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              <SkeletonTable rows={4} columns={3} />
            </tbody>
          </table>
        )}
      </div>
    );
  }

  const aiReason = transaction ? getRootCauseLabel(transaction) : "Unknown";
  const isClosed = caseFile.status === CaseStatus.Resolved;
  const isEscalated = caseFile.status === CaseStatus.Escalated;

  const copyEntry = async () => {
    if (!recommendation?.bookingEntry) {
      return;
    }
    const text = formatBookingEntry(recommendation.bookingEntry);
    try {
      await navigator.clipboard.writeText(text);
      addToast({ message: "Booking entry copied", type: "success" });
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      addToast({ message: "Booking entry copied", type: "success" });
    }
  };

  const proposeRecommendation = () => {
    if (!recommendation) {
      return;
    }
    markRecommendationProposed(caseId, recommendation.id);
    setProposed(recommendation.id);
    addToast({ message: "Recommendation marked as proposed", type: "success" });
  };

  // Escalating with a fix is one operation: the snapshot is attached only
  // once the escalation itself succeeds. An escalated case just takes the fix.
  const addRecommendationToEscalation = () => {
    if (!recommendation || !caseFile) {
      return;
    }
    if (planEscalateWithFix(caseFile.status) === "ATTACH_ONLY") {
      attachRecommendationToEscalation(caseId, recommendation);
      addToast({ message: "Fix attached to the escalation", type: "success" });
      void queryClient.invalidateQueries({ queryKey: ["escalations"] });
      return;
    }
    setAttachOnEscalate(true);
    setDecisionModal("ESCALATE");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-slate-500">
            <Link to="/inbox" className="hover:underline">
              Inbox
            </Link>{" "}
            / {caseFile.caseId}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Case Review</h1>
          <p className="text-sm text-slate-600">Single case story and evidence.</p>
          <p className="text-sm text-slate-600">
            Review, then close with rationale and evidence, or escalate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setDecisionModal("CLOSE_AS_RESOLVED")}
            disabled={isClosed}
          >
            Close case
          </button>
          <button
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            onClick={() => setDecisionModal("OVERRIDE")}
          >
            {isClosed ? "Reopen / Override" : "Override"}
          </button>
          <button
            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setDecisionModal("ESCALATE")}
            disabled={isEscalated}
          >
            Escalate
          </button>
        </div>
      </header>

      {recommendation ? (
        <RecommendationCard
          recommendation={recommendation}
          proposed={proposed === recommendation.id}
          onCopyEntry={copyEntry}
          onPropose={proposeRecommendation}
          onEscalate={addRecommendationToEscalation}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
          No recommendation for this case.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Transaction</h2>
          <dl className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <dt>Vendor</dt>
              <dd className="font-medium text-slate-900">
                {transaction?.vendor ?? "Unknown"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Amount</dt>
              <dd className="font-medium text-slate-900">
                {transaction ? formatCurrency(transaction.amount) : "$--"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2">
                Variance
                <InfoTooltip
                  label="Variance definition"
                  text="Reported monetary variance from the source file. Its sign convention is not yet defined by an accounting owner."
                />
              </dt>
              <dd className="font-medium text-slate-900">
                {transaction ? formatCurrency(transaction.variance) : "$--"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2">
                AI Reason
                <InfoTooltip
                  label="AI Reason definition"
                  text="AI's likely root cause for the variance."
                />
              </dt>
              <dd className="font-medium text-slate-900">{aiReason}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Status</h2>
          <div className="mt-3">
            <StatusPill status={caseFile.status} />
          </div>
          {transaction && (
            <div className="mt-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                Match confidence
                <InfoTooltip
                  label="Match confidence"
                  text="Model confidence in the transaction match."
                />
              </div>
              <ConfidencePill
                band={transaction.confidenceBand}
                score={transaction.confidenceScore}
              />
            </div>
          )}
          {caseFile.resolvedAt && (
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <div>Closed {new Date(caseFile.resolvedAt).toLocaleString()}</div>
              {caseFile.closureDisposition === "DOCUMENTED_EXCEPTION" ? (
                <div className="text-amber-800">
                  Documented exception: match not confirmed; residual variance{" "}
                  {formatCurrency(caseFile.residualVariance ?? 0)} not cleared by a posted
                  correction.
                </div>
              ) : caseFile.closureDisposition === "MATCH_CONFIRMED" ? (
                <div>Match confirmed at closure.</div>
              ) : (
                <div>{describeClosure(caseFile)}.</div>
              )}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Run Log (simulated)</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {caseFile.runLog.map((entry) => (
              <li key={entry.id}>
                <div className="text-xs text-slate-400">{entry.timestamp}</div>
                <div>{entry.message}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Case panels"
          onKeyDown={handleTabKeyDown}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "evidence"}
            aria-controls="panel-evidence"
            id="tab-evidence"
            tabIndex={activeTab === "evidence" ? 0 : -1}
            ref={(node) => {
              tabRefs.current[0] = node;
            }}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              activeTab === "evidence"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setActiveTab("evidence")}
          >
            Evidence
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "structured"}
            aria-controls="panel-structured"
            id="tab-structured"
            tabIndex={activeTab === "structured" ? 0 : -1}
            ref={(node) => {
              tabRefs.current[1] = node;
            }}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              activeTab === "structured"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setActiveTab("structured")}
          >
            Structured
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "conflicts"}
            aria-controls="panel-conflicts"
            id="tab-conflicts"
            tabIndex={activeTab === "conflicts" ? 0 : -1}
            ref={(node) => {
              tabRefs.current[2] = node;
            }}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              activeTab === "conflicts"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setActiveTab("conflicts")}
          >
            Conflicts
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "runlog"}
            aria-controls="panel-runlog"
            id="tab-runlog"
            tabIndex={activeTab === "runlog" ? 0 : -1}
            ref={(node) => {
              tabRefs.current[3] = node;
            }}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              activeTab === "runlog"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setActiveTab("runlog")}
          >
            Run Log
          </button>
        </div>
        {activeTab === "evidence" ? (
          <div role="tabpanel" id="panel-evidence" aria-labelledby="tab-evidence">
            <ClaimsPanel caseFile={caseFile} />
          </div>
        ) : activeTab === "structured" ? (
          <div role="tabpanel" id="panel-structured" aria-labelledby="tab-structured">
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Structured comparison</caption>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">Field</th>
                    <th scope="col" className="px-4 py-3">Expected</th>
                    <th scope="col" className="px-4 py-3">Actual</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {caseFile.structuredRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6">
                        <EmptyState
                          title="No structured rows"
                          subtitle="Review evidence or run log."
                        />
                      </td>
                    </tr>
                  ) : (
                    caseFile.structuredRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.field}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.expected}</td>
                        <td className="px-4 py-3 text-slate-700">{row.actual}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              row.status === "match"
                                ? "bg-emerald-100 text-emerald-900"
                                : row.status === "warning"
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-rose-100 text-rose-900"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === "conflicts" ? (
          <div
            role="tabpanel"
            id="panel-conflicts"
            aria-labelledby="tab-conflicts"
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-slate-700">Conflicts</h2>
            {caseFile.conflicts.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="No conflicts detected"
                  subtitle="Review evidence, then accept."
                />
              </div>
            ) : (
              <ul className="mt-3 space-y-3 text-sm text-slate-700">
                {caseFile.conflicts.map((conflict) => (
                  <li key={conflict.id} className="rounded-md border border-slate-100 p-3">
                    <p className="font-medium text-slate-900">{conflict.description}</p>
                    <div className="mt-2 text-xs text-slate-500">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          conflict.severity === "high"
                            ? "bg-rose-100 text-rose-900"
                            : conflict.severity === "medium"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-emerald-100 text-emerald-900"
                        }`}
                      >
                        {conflict.severity}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-2 text-xs text-slate-600">
                      {conflict.checklist.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
                          >
                            ✓
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div
            role="tabpanel"
            id="panel-runlog"
            aria-labelledby="tab-runlog"
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-slate-700">Run Log</h2>
            <div className="mt-4 space-y-4">
              {["Screen", "Plan", "Retrieve", "Verify", "Report"].map(
                (step, index, steps) => (
                  <div key={step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-700">
                        {index + 1}
                      </div>
                      {index < steps.length - 1 && (
                        <div className="h-full w-px bg-slate-200" aria-hidden="true" />
                      )}
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <div className="font-semibold">{step}</div>
                      <div className="text-xs text-slate-500">
                        {caseFile.runLog[index]?.message ?? "Awaiting log entry."}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </section>

      <OverrideModal
        isOpen={decisionModal !== null}
        initialDecisionType={decisionModal ?? "OVERRIDE"}
        caseFile={caseFile}
        onClose={() => {
          setDecisionModal(null);
          setAttachOnEscalate(false);
        }}
        onSuccess={(message, decisionType) => {
          if (attachOnEscalate && decisionType === "ESCALATE" && recommendation) {
            attachRecommendationToEscalation(caseId, recommendation);
          }
          addToast({ message, type: "success" });
          void queryClient.invalidateQueries({ queryKey: ["cases"] });
          void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
          void queryClient.invalidateQueries({ queryKey: ["escalations"] });
        }}
      />
    </div>
  );
};
