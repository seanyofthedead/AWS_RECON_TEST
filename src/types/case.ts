export enum CaseStatus {
  ScreenedUnresolved = "SCREENED_UNRESOLVED",
  Resolved = "RESOLVED",
  Reviewed = "Reviewed",
  Escalated = "Escalated"
}

export enum ConfidenceBand {
  High = "HIGH",
  Medium = "MEDIUM",
  Low = "LOW"
}

export interface Claim {
  id: string;
  statement: string;
  source: string;
  confidence: number;
  supportedByEvidenceIds: string[];
}

export interface EvidenceObject {
  id: string;
  kind: "document" | "log" | "policy" | "external";
  title: string;
  description: string;
  snippet?: string;
  source: string;
  weight: number;
  createdAt: string;
  url?: string;
}

export interface ConflictFlag {
  id: string;
  description: string;
  severity: "low" | "medium" | "high";
  checklist: string[];
}

export interface RunLogEntry {
  id: string;
  timestamp: string;
  message: string;
}

export interface StructuredRow {
  id: string;
  field: string;
  expected: string;
  actual: string;
  status: "match" | "mismatch" | "warning";
}

export interface MatchEvidence {
  transactionId: string;
  invoiceId?: string;
  poNumber?: string;
  invoicePoNumber?: string;
  receiptId?: string;
  receiptNumber?: string;
  receiptPoNumber?: string;
  glDocumentId?: string;
  glPostingId?: string;
  glInvoiceId?: string;
  vendorId?: string;
  // Display aliases for the join IDs above; never used for comparison.
  displayInvoiceId?: string;
  displayPoNumber?: string;
  invoiceAmount?: string;
  poAmount?: string;
  receiptAmount?: string;
  glAmount?: string;
  // Signed monetary variance reported for the case.
  monetaryVariance?: string;
}

export interface CaseFile {
  caseId: string;
  transactionId: string;
  status: CaseStatus;
  confidenceBand: ConfidenceBand;
  claims: Claim[];
  evidence: EvidenceObject[];
  conflicts: ConflictFlag[];
  runLog: RunLogEntry[];
  structuredRows: StructuredRow[];
  matchEvidence?: MatchEvidence;
  resolvedAt?: string;
  closureDisposition?: "MATCH_CONFIRMED" | "DOCUMENTED_EXCEPTION";
  // True when an analyst decision closed the case, as opposed to fixture data.
  closedByAnalyst?: boolean;
  residualVariance?: number;
  // Number of recorded decisions; used to reject decisions made on a stale view.
  version?: number;
}
