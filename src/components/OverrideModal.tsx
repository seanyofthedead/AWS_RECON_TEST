import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CaseFile } from "../types/case";
import { ReviewDecisionType, ReviewReasonCode } from "../types/review";
import { useDataProvider } from "../hooks/useDataProvider";
import { useToastStore } from "../store/toastStore";
import { evaluateDecision } from "../utils/closurePolicy";

interface OverrideModalProps {
  isOpen: boolean;
  caseFile: CaseFile;
  onClose: () => void;
  onSuccess: (message: string, decisionType: ReviewDecisionType) => void;
  initialDecisionType?: ReviewDecisionType;
}

const decisionOptions: Array<{ value: ReviewDecisionType; label: string }> = [
  { value: "CLOSE_AS_RESOLVED", label: "Close as resolved" },
  { value: "OVERRIDE", label: "Override" },
  { value: "ESCALATE", label: "Escalate" },
  { value: "REQUEST_MORE_EVIDENCE", label: "Request more evidence" }
];

const reasonOptions: Array<{ value: ReviewReasonCode; label: string }> = [
  { value: "POLICY_MATCH", label: "Policy match" },
  { value: "MISSING_DOCUMENTATION", label: "Missing documentation" },
  { value: "VENDOR_EXCEPTION", label: "Vendor exception" },
  { value: "AMOUNT_VARIANCE", label: "Amount variance" },
  { value: "NEEDS_HUMAN_REVIEW", label: "Needs human review" },
  { value: "OTHER", label: "Other" }
];

const titles: Record<ReviewDecisionType, string> = {
  CLOSE_AS_RESOLVED: "Close Case",
  OVERRIDE: "Override Decision",
  ESCALATE: "Escalate Case",
  REQUEST_MORE_EVIDENCE: "Request More Evidence"
};

export const OverrideModal = ({
  isOpen,
  caseFile,
  onClose,
  onSuccess,
  initialDecisionType = "OVERRIDE"
}: OverrideModalProps) => {
  const dataProvider = useDataProvider();
  const addToast = useToastStore((state) => state.addToast);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [decisionType, setDecisionType] = useState<ReviewDecisionType>("OVERRIDE");
  const [reasonCode, setReasonCode] = useState<ReviewReasonCode>("OTHER");
  const [rationale, setRationale] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: () =>
      dataProvider.reviewCase(caseFile.caseId, {
        decisionType,
        reasonCode,
        rationale,
        evidenceIds: selectedEvidence
      }),
    onSuccess: () => {
      onSuccess(`Decision submitted for ${caseFile.caseId}.`, decisionType);
      onClose();
    },
    onError: (error) => {
      addToast({
        message:
          error instanceof Error && error.message
            ? `Decision rejected: ${error.message}`
            : "Unable to submit decision. Try again.",
        type: "error"
      });
    }
  });

  // Each open starts a fresh decision for the current case.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDecisionType(initialDecisionType);
    setReasonCode(initialDecisionType === "ESCALATE" ? "NEEDS_HUMAN_REVIEW" : "OTHER");
    setRationale("");
    setSelectedEvidence([]);
  }, [isOpen, initialDecisionType, caseFile.caseId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'select, textarea, button, input[type="checkbox"], input[type="text"]'
    );
    focusable?.[0]?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'select, textarea, button, input[type="checkbox"], input[type="text"]'
      );
      if (!focusable || focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const toggleEvidence = (id: string) => {
    setSelectedEvidence((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const check = useMemo(
    () =>
      evaluateDecision({
        decisionType,
        caseFile,
        rationale,
        evidenceIds: selectedEvidence
      }),
    [decisionType, caseFile, rationale, selectedEvidence]
  );
  const canSubmit = check.allowed;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="override-modal-title"
        className="w-full max-w-2xl rounded-lg bg-white shadow-lg"
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 id="override-modal-title" className="text-lg font-semibold text-slate-900">
            {titles[decisionType]}
          </h2>
          <p className="text-sm text-slate-600">
            Provide rationale and supporting evidence for this decision.
          </p>
        </div>
        <div className="space-y-4 px-6 py-4 text-sm text-slate-700">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Decision Type
            </span>
            <select
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2"
              value={decisionType}
              onChange={(event) => setDecisionType(event.target.value as ReviewDecisionType)}
            >
              {decisionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reason Code
            </span>
            <select
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value as ReviewReasonCode)}
            >
              {reasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rationale
            </span>
            <textarea
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2"
              rows={4}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder="Describe the basis for this decision."
            />
          </label>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Attach Evidence {decisionType === "CLOSE_AS_RESOLVED" ? "(required)" : "(optional)"}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {caseFile.evidence.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-2 rounded-md border border-slate-100 p-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvidence.includes(item.id)}
                    onChange={() => toggleEvidence(item.id)}
                  />
                  <span>
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.source}</div>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {check.blockers.length > 0 || check.warnings.length > 0 ? (
          <div className="space-y-1 px-6 pb-4 text-xs" aria-live="polite">
            {check.blockers.map((item) => (
              <div key={item} className="text-rose-800">
                Required: {item}
              </div>
            ))}
            {check.warnings.map((item) => (
              <div key={item} className="text-amber-800">
                Note: {item}
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
          >
            Submit decision
          </button>
        </div>
      </div>
    </div>
  );
};
