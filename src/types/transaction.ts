import { CaseStatus, ConfidenceBand } from "./case";

export interface TransactionRow {
  transactionId: string;
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
}
