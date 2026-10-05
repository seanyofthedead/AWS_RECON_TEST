import { CaseStatus, ConfidenceBand } from "./case";

export interface TransactionRow {
  // Display alias shown in the demo; not a source-system ID.
  transactionId: string;
  // Immutable source IDs, as they appear in the source files and PDFs.
  sourceTransactionId?: string;
  sourceVendorId?: string;
  // Date the goods or services were provided, when the source supplies it.
  serviceDate?: string;
  // Feeder minus ERP quantity, in units. Distinct from the monetary variance.
  quantityDelta?: number;
  postingDate: string;
  vendor: string;
  amount: number;
  variance: number;
  confidenceScore: number;
  caseId: string;
  status: CaseStatus;
  confidenceBand: ConfidenceBand;
  reviewed: boolean;
  lastUpdated: string;
  canonicalAiReason?: string;
  canonicalVarianceCategory?: string;
  rootCauseBucket?:
    | "Conversion Error"
    | "Unknown / Needs Review"
    | "Accrual Reversal"
    | "Missing Receipt"
    | "Timing Difference"
    | "Manual Entry Error"
    | "Stale Master Data"
    | "Reference Data Misalignment"
    | "Wrong PO Reference"
    | "Batch Interface Failure"
    | "Duplicate Transaction"
    | "Unit of Measure Mismatch"
    | "Partial Posting"
    | "Wrong Vendor Mapping"
    | "Price Variance"
    | "Other";
  rootCauseDetail?: string;
  resolvedAt?: string;
  closureDisposition?: "MATCH_CONFIRMED" | "DOCUMENTED_EXCEPTION";
  // True when an analyst decision closed the case, as opposed to fixture data.
  closedByAnalyst?: boolean;
  // Join references carried by the source invoice row, kept separate from
  // the display transaction ID.
  sourceRefs?: {
    invoiceId?: string;
    poNumber?: string;
    vendorId?: string;
    invoiceAmount?: string;
  };
}
