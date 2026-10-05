import { CaseFile, CaseStatus } from "../types/case";
import { ReviewDecisionType } from "../types/review";
import { evaluateThreeWayMatch } from "./threeWayMatch";

export const MIN_RATIONALE_LENGTH = 15;

export type ClosureDisposition = "MATCH_CONFIRMED" | "DOCUMENTED_EXCEPTION";

export interface DecisionCheck {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
  disposition?: ClosureDisposition;
}

// Statuses each decision may start from. Closing a closed case or escalating
// an escalated one is rejected rather than silently re-applied.
const ALLOWED_FROM: Record<ReviewDecisionType, CaseStatus[]> = {
  CLOSE_AS_RESOLVED: [CaseStatus.ScreenedUnresolved, CaseStatus.Reviewed, CaseStatus.Escalated],
  ESCALATE: [CaseStatus.ScreenedUnresolved, CaseStatus.Reviewed, CaseStatus.Resolved],
  OVERRIDE: [
    CaseStatus.ScreenedUnresolved,
    CaseStatus.Reviewed,
    CaseStatus.Escalated,
    CaseStatus.Resolved
  ],
  REQUEST_MORE_EVIDENCE: [
    CaseStatus.ScreenedUnresolved,
    CaseStatus.Reviewed,
    CaseStatus.Escalated,
    CaseStatus.Resolved
  ]
};

const STATUS_LABELS: Record<CaseStatus, string> = {
  [CaseStatus.ScreenedUnresolved]: "open",
  [CaseStatus.Reviewed]: "reviewed",
  [CaseStatus.Escalated]: "escalated",
  [CaseStatus.Resolved]: "closed"
};

// Single rule set used by the provider and every page that offers a decision.
export const evaluateDecision = (input: {
  decisionType: ReviewDecisionType;
  caseFile: CaseFile;
  rationale: string;
  evidenceIds: string[];
}): DecisionCheck => {
  const { decisionType, caseFile } = input;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!ALLOWED_FROM[decisionType].includes(caseFile.status)) {
    blockers.push(`Case is already ${STATUS_LABELS[caseFile.status]}.`);
  }
  if (input.rationale.trim().length < MIN_RATIONALE_LENGTH) {
    blockers.push(`Rationale must be at least ${MIN_RATIONALE_LENGTH} characters.`);
  }

  if (decisionType !== "CLOSE_AS_RESOLVED") {
    return { allowed: blockers.length === 0, blockers, warnings };
  }

  const knownEvidence = new Map(caseFile.evidence.map((item) => [item.id, item]));
  if (input.evidenceIds.length === 0) {
    blockers.push("Attach at least one evidence document.");
  } else if (input.evidenceIds.some((id) => !knownEvidence.has(id))) {
    blockers.push("Attached evidence does not belong to this case.");
  } else if (!input.evidenceIds.some((id) => knownEvidence.get(id)?.url)) {
    // A placeholder for a missing record (e.g. no receipt) is not a document.
    blockers.push("Attach at least one evidence document that is on file.");
  }

  const match = evaluateThreeWayMatch(caseFile.matchEvidence);
  if (match.status === "fail") {
    blockers.push("Three-way match failed; correct the mismatch or escalate.");
  } else if (match.status === "inconclusive") {
    warnings.push(
      "Three-way match is inconclusive; closing records a documented exception, not a verified match."
    );
  }
  const highConflicts = caseFile.conflicts.filter((conflict) => conflict.severity === "high");
  if (highConflicts.length > 0) {
    warnings.push(`${highConflicts.length} high-severity conflict(s) remain on this case.`);
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
    disposition: match.status === "pass" ? "MATCH_CONFIRMED" : "DOCUMENTED_EXCEPTION"
  };
};
