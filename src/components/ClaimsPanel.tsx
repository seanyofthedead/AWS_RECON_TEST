import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { CaseFile } from "../types/case";
import { useDataProvider } from "../hooks/useDataProvider";
import { evaluateThreeWayMatch } from "../utils/threeWayMatch";

interface ClaimsPanelProps {
  caseFile: CaseFile;
}

export const ClaimsPanel = ({ caseFile }: ClaimsPanelProps) => {
  const dataProvider = useDataProvider();
  const [selectedClaimId, setSelectedClaimId] = useState(
    caseFile.claims[0]?.id ?? ""
  );
  // Results are keyed by claim and evidence together: a check confirms that
  // this claim cites this document, not the document in general.
  const [verifyingKey, setVerifyingKey] = useState<string | null>(null);
  const [linkResults, setLinkResults] = useState<Record<string, "linked" | "not-linked" | "error">>(
    {}
  );
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Only move focus after keyboard navigation; focusing on mount scrolls the page.
  const keyboardNavRef = useRef(false);

  useEffect(() => {
    const stillExists = caseFile.claims.some((claim) => claim.id === selectedClaimId);
    if (!stillExists) {
      setSelectedClaimId(caseFile.claims[0]?.id ?? "");
    }
  }, [caseFile, selectedClaimId]);

  useEffect(() => {
    if (!keyboardNavRef.current) {
      return;
    }
    keyboardNavRef.current = false;
    const index = caseFile.claims.findIndex((claim) => claim.id === selectedClaimId);
    if (index >= 0) {
      buttonRefs.current[index]?.focus();
    }
  }, [caseFile.claims, selectedClaimId]);

  const selectedClaim = useMemo(
    () => caseFile.claims.find((claim) => claim.id === selectedClaimId) ?? null,
    [caseFile.claims, selectedClaimId]
  );

  const linkedEvidence = useMemo(() => {
    if (!selectedClaim) {
      return [];
    }
    const set = new Set(selectedClaim.supportedByEvidenceIds);
    return caseFile.evidence.filter((item) => set.has(item.id));
  }, [caseFile.evidence, selectedClaim]);

  const matchResult = useMemo(
    () => evaluateThreeWayMatch(caseFile.matchEvidence),
    [caseFile.matchEvidence]
  );

  const statusLabel = (status: string) =>
    status === "pass" ? "PASS" : status === "fail" ? "FAIL" : "INCONCLUSIVE";
  const statusTone = (status: string) =>
    status === "pass"
      ? "bg-emerald-100 text-emerald-900"
      : status === "fail"
        ? "bg-rose-100 text-rose-900"
        : "bg-amber-100 text-amber-900";

  const linkKey = (claimId: string, evidenceId: string) => `${claimId}::${evidenceId}`;

  const verifyMutation = useMutation({
    mutationFn: (request: { claimId: string; evidenceId: string }) =>
      dataProvider.verifyLink({ caseId: caseFile.caseId, ...request }),
    onMutate: (request) => {
      setVerifyingKey(linkKey(request.claimId, request.evidenceId));
    },
    onSuccess: (data, request) => {
      setLinkResults((prev) => ({
        ...prev,
        [linkKey(request.claimId, request.evidenceId)]: data?.ok === true ? "linked" : "not-linked"
      }));
    },
    onError: (_error, request) => {
      setLinkResults((prev) => ({
        ...prev,
        [linkKey(request.claimId, request.evidenceId)]: "error"
      }));
    },
    onSettled: () => {
      setVerifyingKey(null);
    }
  });

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    if (caseFile.claims.length === 0) {
      return;
    }
    keyboardNavRef.current = true;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (index + 1) % caseFile.claims.length;
      setSelectedClaimId(caseFile.claims[nextIndex].id);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = (index - 1 + caseFile.claims.length) % caseFile.claims.length;
      setSelectedClaimId(caseFile.claims[nextIndex].id);
    } else if (event.key === "Home") {
      event.preventDefault();
      setSelectedClaimId(caseFile.claims[0].id);
    } else if (event.key === "End") {
      event.preventDefault();
      setSelectedClaimId(caseFile.claims[caseFile.claims.length - 1].id);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedClaimId(caseFile.claims[index].id);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr,2fr]">
      <section
        className="rounded-lg border border-slate-200 bg-white p-4"
        aria-label="Claims list"
      >
        <h3 className="text-sm font-semibold text-slate-700">Claims</h3>
        <p className="mt-1 text-xs text-slate-500">
          Use arrow keys to move, Enter to select.
        </p>
        <div className="mt-4 space-y-2" role="listbox" aria-label="Claims">
          {caseFile.claims.map((claim, index) => {
            const isActive = claim.id === selectedClaimId;
            return (
              <button
                key={claim.id}
                ref={(node) => {
                  buttonRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setSelectedClaimId(claim.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? "border-slate-900 bg-slate-50 text-slate-900"
                    : "border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900"
                }`}
              >
                <div className="font-semibold">{claim.statement}</div>
                <div className="mt-1 text-xs text-slate-500">{claim.source}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="rounded-lg border border-slate-200 bg-white p-4"
        aria-live="polite"
      >
        <h3 className="text-sm font-semibold text-slate-700">Linked Evidence</h3>
        <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-slate-900">Three-Way Match</div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusTone(matchResult.referenceStatus)}`}
              >
                Reference links: {statusLabel(matchResult.referenceStatus)}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusTone(matchResult.amountStatus)}`}
              >
                Amounts: {statusLabel(matchResult.amountStatus)}
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs text-slate-600">
            <div>Invoice: {matchResult.invoiceNote}</div>
            <div>PO: {matchResult.poNote}</div>
            <div>Receipt: {matchResult.receiptNote}</div>
            <div>GL: {matchResult.glNote}</div>
            <div>Amounts: {matchResult.amountNote}</div>
            <div className="pt-1 text-slate-400">
              Compared on source join IDs; document cards below show display IDs.
            </div>
          </div>
        </div>
        {!selectedClaim ? (
          <p className="mt-3 text-sm text-slate-600">Select a claim to see evidence.</p>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-900">Selected Claim</div>
              <div className="mt-2 text-slate-700">{selectedClaim.statement}</div>
              <div className="mt-2 text-xs text-slate-500">
                Source: {selectedClaim.source} · Confidence{" "}
                {Math.round(selectedClaim.confidence * 100)}%
              </div>
            </div>
            {linkedEvidence.length === 0 ? (
              <p className="text-sm text-slate-600">No linked evidence found.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {linkedEvidence.map((item) => {
                  const key = linkKey(selectedClaimId, item.id);
                  const isVerifying = verifyingKey === key;
                  const result = linkResults[key];
                  return (
                    <div
                      key={item.id}
                      className="flex h-full flex-col justify-between rounded-md border border-slate-100 p-3 text-sm"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-xs uppercase text-slate-400">
                          {item.kind}
                        </div>
                        {item.snippet && (
                          <p className="mt-2 text-sm text-slate-700">{item.snippet}</p>
                        )}
                        <div className="mt-2 text-xs text-slate-500">
                          Source: {item.source}
                        </div>
                        <div className="text-xs text-slate-500">
                          Created: {new Date(item.createdAt).toLocaleString()}
                        </div>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-xs font-semibold text-slate-700 underline-offset-4 hover:underline"
                            aria-label={`Open PDF for ${item.title}`}
                          >
                            Open PDF
                          </a>
                        ) : (
                          <div className="mt-2 text-xs text-slate-400">Missing</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          verifyMutation.mutate({ claimId: selectedClaimId, evidenceId: item.id })
                        }
                        disabled={isVerifying || result === "linked" || !selectedClaimId}
                        className="mt-3 inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isVerifying
                          ? "Checking…"
                          : result === "linked"
                            ? "Claim cites this document"
                            : "Check claim reference"}
                      </button>
                      {result === "not-linked" ? (
                        <div className="mt-1 text-xs text-rose-800">
                          Reference not confirmed for this claim.
                        </div>
                      ) : result === "error" ? (
                        <div className="mt-1 text-xs text-rose-800">
                          Check failed; try again.
                        </div>
                      ) : result === "linked" ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Confirms the reference only, not the document's contents.
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
