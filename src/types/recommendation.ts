export type RootCauseCategory =
  | "TIMING"
  | "DUPLICATE"
  | "MISCODED_ACCOUNT"
  | "MISSING_ACCRUAL"
  | "FX_REVALUATION"
  | "VENDOR_RATE_ERROR"
  | "REVERSAL_MISSING"
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
