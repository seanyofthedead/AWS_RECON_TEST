export type RootCauseCategory =
  | "TIMING"
  | "DUPLICATE"
  | "REVERSAL_MISSING"
  | "MISSING_RECEIPT"
  | "MANUAL_ENTRY_ERROR"
  | "STALE_MASTER_DATA"
  | "REFERENCE_DATA"
  | "WRONG_PO_REFERENCE"
  | "BATCH_INTERFACE"
  | "UOM_MISMATCH"
  | "PARTIAL_POSTING"
  | "WRONG_VENDOR_MAPPING"
  | "PRICE_VARIANCE"
  | "CONVERSION_ERROR"
  | "MISSING_ACCRUAL"
  | "MISCODED_ACCOUNT"
  | "VENDOR_RATE_ERROR"
  | "FX_REVALUATION"
  | "OTHER";

export type RecommendationConfidence = "High" | "Medium" | "Low";

export type BookingEntryLine = {
  direction: "DEBIT" | "CREDIT";
  account: string;
  amount: number;
};

export type BookingEntry = {
  memo: string;
  lines: BookingEntryLine[];
  effectiveDate?: string;
  period?: string;
};

export type Recommendation = {
  id: string;
  title: string;
  nextSteps: string[];
  bookingEntry?: BookingEntry;
  confidence: RecommendationConfidence;
  rationale: string;
  source: "rules" | "mock";
};

export type CaseRecommendations = Record<string, Recommendation[]>;
