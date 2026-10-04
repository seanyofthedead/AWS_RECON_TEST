import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider } from "../hooks/useDataProvider";
import { CaseStatus } from "../types/case";
import { useToastStore } from "../store/toastStore";
import { SkeletonTable } from "../components/SkeletonTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { InfoTooltip } from "../components/InfoTooltip";
import { useRoutePerf } from "../hooks/useRoutePerf";
import { useRecommendations } from "../hooks/useRecommendations";
import { getRootCauseLabel } from "../utils/rootCause";
import { RecommendationCard } from "../components/RecommendationCard";
import { OverrideModal } from "../components/OverrideModal";

export const EscalationsPage = () => {
  useRoutePerf("Escalations");
  const dataProvider = useDataProvider();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">(
    "all"
  );
  const hasErrorToasted = useRef(false);

  const { data: escalations = [], isLoading, error } = useQuery({
    queryKey: ["escalations"],
    queryFn: () => dataProvider.getEscalations()
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: () => dataProvider.getCases()
  });

  const { data: selectedCase, error: caseError } = useQuery({
    queryKey: ["case", selectedCaseId],
    queryFn: () => dataProvider.getCase(selectedCaseId ?? ""),
    enabled: Boolean(selectedCaseId)
  });

  const { data: selectedPacket, error: packetError } = useQuery({
    queryKey: ["escalations", selectedCaseId],
    queryFn: () => dataProvider.getEscalation(selectedCaseId ?? ""),
    enabled: Boolean(selectedCaseId)
  });

  const [closeOpen, setCloseOpen] = useState(false);

  const priorityStyles: Record<string, string> = {
    low: "bg-slate-100 text-slate-700",
    medium: "bg-amber-100 text-amber-900",
    high: "bg-rose-100 text-rose-900"
  };

  const filteredEscalations = useMemo(() => {
    if (priorityFilter === "all") {
      return escalations;
    }
    return escalations.filter((packet) => packet.priority === priorityFilter);
  }, [escalations, priorityFilter]);

  const selectedTransaction = useMemo(() => {
    return cases.find((row) => row.caseId === selectedCaseId);
  }, [cases, selectedCaseId]);

  const { primary: recommendation } = useRecommendations({
    caseId: selectedCaseId ?? "",
    transaction: selectedTransaction,
    includeEscalationAttachment: true
  });

  useEffect(() => {
    if (filteredEscalations.length === 0) {
      if (selectedCaseId) {
        setSelectedCaseId(null);
      }
      return;
    }
    if (!selectedCaseId) {
      setSelectedCaseId(filteredEscalations[0].caseId);
      return;
    }
    const stillVisible = filteredEscalations.some((packet) => packet.caseId === selectedCaseId);
    if (!stillVisible) {
      setSelectedCaseId(filteredEscalations[0].caseId);
    }
  }, [filteredEscalations, selectedCaseId]);

  useEffect(() => {
    if (error || caseError || packetError) {
      if (!hasErrorToasted.current) {
        addToast({ message: "Unable to load escalation data.", type: "error" });
        hasErrorToasted.current = true;
      }
    } else {
      hasErrorToasted.current = false;
    }
  }, [error, caseError, packetError, addToast]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Escalations</h1>
        <p className="text-sm text-slate-600">Cases escalated for human review.</p>
        <p className="text-sm text-slate-600">Open a packet, review, then close.</p>
      </header>

      {filteredEscalations.length > 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span>Escalations waiting: {filteredEscalations.length}.</span>
          <button
            type="button"
            className="rounded-md border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            onClick={() => setSelectedCaseId(filteredEscalations[0].caseId)}
          >
            Open next
          </button>
        </section>
      ) : null}

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <span className="font-semibold uppercase tracking-wide text-slate-500">
          Priority
        </span>
        {(["all", "high", "medium", "low"] as const).map((priority) => (
          <button
            key={priority}
            type="button"
            className={`rounded-md border px-3 py-1 font-semibold ${
              priorityFilter === priority
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => setPriorityFilter(priority)}
          >
            {priority === "all" ? "All" : priority}
          </button>
        ))}
        <InfoTooltip
          label="Priority definition"
          text="Demo priority is seeded per case; it is not yet derived from exposure, age, or deadlines."
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr,3fr]">
        <div className="space-y-3">
          {isLoading && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  <SkeletonTable rows={4} columns={3} />
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && error && (
            <ErrorState
              title="Unable to load escalations"
              message="Refresh the page to retry loading escalation data."
            />
          )}
          {!isLoading && !error && filteredEscalations.length === 0 && (
            <EmptyState
              title="No escalations"
              subtitle="Review cases in Inbox to escalate."
              actionLabel="Go to Inbox"
              onAction={() => navigate("/inbox")}
            />
          )}
          {filteredEscalations.map((packet) => (
            <div
              key={packet.caseId}
              className={`rounded-lg border p-4 ${
                selectedCaseId === packet.caseId
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{packet.caseId}</div>
                  <div className="mt-1 text-xs text-slate-500">{packet.reasonSummary}</div>
                  <div className="mt-2 text-xs text-slate-400">
                    Created {new Date(packet.createdAt).toLocaleString()}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    priorityStyles[packet.priority]
                  }`}
                >
                  {packet.priority}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setSelectedCaseId(packet.caseId)}
                >
                  Open Packet
                </button>
                <Link
                  to={`/cases/${packet.caseId}`}
                  className="text-xs font-semibold text-slate-700 underline-offset-4 hover:underline"
                >
                  Open case workspace
                </Link>
              </div>
            </div>
          ))}
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Reviewer Packet</h2>
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            <li>• Summary and priority</li>
            <li>• Evidence snapshot</li>
            <li>• Next actions checklist</li>
          </ul>
          {!selectedPacket ? (
            <p className="mt-3 text-sm text-slate-600">Select a packet to review.</p>
          ) : (
            <div className="mt-3 space-y-4 text-sm text-slate-600">
              {(caseError || packetError) && (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  Unable to load packet details. Try again.
                </div>
              )}
              <div>
                <div className="text-base font-semibold text-slate-900">
                  {selectedPacket.caseId}
                </div>
                <div className="mt-1">{selectedPacket.summary}</div>
                <div className="mt-2 text-xs text-slate-500">
                  Priority: {selectedPacket.priority} · Requested by{" "}
                  {selectedPacket.requestedBy}
                </div>
                <div className="text-xs text-slate-500">
                  Created: {new Date(selectedPacket.createdAt).toLocaleString()}
                </div>
              </div>

              {selectedCase && (
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs">
                  <div className="font-semibold text-slate-900">Case Summary</div>
                  <div className="mt-1">
                    Transaction {selectedCase.transactionId} · Status{" "}
                    {selectedCase.status === CaseStatus.ScreenedUnresolved
                      ? "Open (in queue)"
                      : selectedCase.status}
                  </div>
                  <div>
                    Evidence: {selectedCase.evidence.length} · Conflicts:{" "}
                    {selectedCase.conflicts.length}
                  </div>
                </div>
              )}

              <div className="rounded-md border border-slate-100 bg-white p-3 text-xs text-slate-600">
                <div className="font-semibold text-slate-900">Root cause</div>
                <div className="mt-1">
                  {selectedTransaction ? getRootCauseLabel(selectedTransaction) : "Unknown"}
                </div>
              </div>

              {recommendation ? (
                <RecommendationCard recommendation={recommendation} showActions={false} />
              ) : (
                <div className="rounded-md border border-dashed border-slate-200 bg-white p-3 text-xs text-slate-500">
                  No recommendation for this case.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-100 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Attempted Steps
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {selectedPacket.attemptedSteps.map((step) => (
                      <li key={step}>• {step}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border border-slate-100 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Evidence Found
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {selectedPacket.evidenceFound.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border border-slate-100 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Missing Checklist
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {selectedPacket.missingChecklist.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border border-slate-100 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Suggested Next Actions
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {selectedPacket.suggestedNextActions.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCloseOpen(true)}
                disabled={!selectedCase}
                className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Close Escalation
              </button>
            </div>
          )}
        </aside>
      </div>
      {selectedCase ? (
        <OverrideModal
          isOpen={closeOpen}
          initialDecisionType="CLOSE_AS_RESOLVED"
          caseFile={selectedCase}
          onClose={() => setCloseOpen(false)}
          onSuccess={(message) => {
            addToast({ message, type: "success" });
            void queryClient.invalidateQueries({ queryKey: ["cases"] });
            void queryClient.invalidateQueries({ queryKey: ["case", selectedCase.caseId] });
            void queryClient.invalidateQueries({ queryKey: ["escalations"] });
          }}
        />
      ) : null}
    </div>
  );
};
