export type ReviewDecisionType =
  | "CLOSE_AS_RESOLVED"
  | "OVERRIDE"
  | "ESCALATE"
  | "REQUEST_MORE_EVIDENCE";

export type ReviewDecisionAction = "ACCEPT" | "OVERRIDE" | "ESCALATE" | "REQUEST_MORE_EVIDENCE";

export type ReviewReasonCode =
  | "POLICY_MATCH"
  | "MISSING_DOCUMENTATION"
  | "VENDOR_EXCEPTION"
  | "AMOUNT_VARIANCE"
  | "NEEDS_HUMAN_REVIEW"
  | "OTHER";

export interface ReviewRequestNormalized {
  decisionType: ReviewDecisionType;
  reasonCode: ReviewReasonCode;
  rationale: string;
  evidenceIds: string[];
  // Case version the reviewer saw; a mismatch means someone else decided first.
  expectedVersion?: number;
}

export type ReviewRequest =
  | ReviewRequestNormalized
  | {
      decision: ReviewDecisionAction;
      rationaleText: string;
      reasonCode?: ReviewReasonCode;
      evidenceIds?: string[];
    };

export interface ReviewDecision extends Omit<ReviewRequestNormalized, "expectedVersion"> {
  caseId: string;
  reviewer: string;
  // Identity-provider subject of the signed-in reviewer, when known.
  reviewerId?: string;
  timestamp: string;
  // Set on closures: whether the match was confirmed or the case was closed
  // as a documented exception, and the variance still outstanding at closure.
  disposition?: "MATCH_CONFIRMED" | "DOCUMENTED_EXCEPTION";
  residualVariance?: number;
}
