export interface QueueItem {
  caseId: string;
  title: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_review" | "closed";
}

export interface ReviewerPacket {
  caseId: string;
  summary: string;
  reasonSummary: string;
  priority: "low" | "medium" | "high";
  requestedBy: string;
  submittedAt: string;
  createdAt: string;
  attemptedSteps: string[];
  evidenceFound: string[];
  missingChecklist: string[];
  suggestedNextActions: string[];
}
