import { TransactionRow } from "../types/transaction";

type RootCauseLabel =
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

const CANONICAL_ROOT_CAUSE_LABELS = [
  "Conversion Error",
  "Unknown / Needs Review",
  "Accrual Reversal",
  "Missing Receipt",
  "Timing Difference",
  "Manual Entry Error",
  "Stale Master Data",
  "Reference Data Misalignment",
  "Wrong PO Reference",
  "Batch Interface Failure",
  "Duplicate Transaction",
  "Unit of Measure Mismatch",
  "Partial Posting",
  "Wrong Vendor Mapping",
  "Price Variance"
] as const;

const CANONICAL_ROOT_CAUSE_LABEL_SET = new Set<string>(CANONICAL_ROOT_CAUSE_LABELS);

const toTitleCase = (value: string) =>
  value.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());

const cleanReason = (raw?: string) => {
  if (!raw) {
    return "";
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const upper = trimmed.toUpperCase();
  const emptyValues = new Set([
    "N/A",
    "NA",
    "UNKNOWN",
    "NEEDS REVIEW"
  ]);
  if (emptyValues.has(upper)) {
    return "";
  }
  const normalized = trimmed.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return toTitleCase(normalized);
};

const normalizeCanonical = (raw?: string) => {
  const cleaned = cleanReason(raw);
  if (!cleaned) {
    return "";
  }
  // Ensure we match canonical strings even if spacing around '/' varies.
  return cleaned.replace(/\s*\/\s*/g, " / ").replace(/\s+/g, " ").trim();
};

export const getRootCauseLabel = (row: TransactionRow): RootCauseLabel => {
  const canonicalCandidate = row.canonicalAiReason ?? row.canonicalVarianceCategory;
  const normalized = normalizeCanonical(canonicalCandidate);
  const label: RootCauseLabel = CANONICAL_ROOT_CAUSE_LABEL_SET.has(normalized)
    ? (normalized as RootCauseLabel)
    : "Other";

  row.rootCauseBucket = label;
  row.rootCauseDetail = normalized || undefined;
  return label;
};
