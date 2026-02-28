import { hashString } from "./hash";
import { getRootCauseLabel } from "./rootCause";
import { TransactionRow } from "../types/transaction";
import {
  BookingEntry,
  Recommendation,
  RootCauseCategory,
  RecommendationConfidence
} from "../types/recommendation";

type RecommendationInput = {
  caseId: string;
  transaction?: TransactionRow;
  aiReason?: string;
};

const STORAGE_KEY_PROPOSED = "recon_recommendation_proposed_v1";
const STORAGE_KEY_ESCALATION = "recon_recommendation_escalation_v1";

const accountMap = {
  expense: "Expense",
  accrued: "Accrued Expenses",
  ap: "Accounts Payable",
  revenue: "Revenue",
  deferred: "Deferred Revenue",
  cash: "Cash",
  fx: "FX Gain/Loss",
  intercompany: "Intercompany"
};

const safeStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
};

const readStorageMap = (key: string) => {
  const storage = safeStorage();
  if (!storage) {
    return {} as Record<string, string>;
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
};

const writeStorageMap = (key: string, map: Record<string, string>) => {
  const storage = safeStorage();
  if (!storage) {
    return;
  }
  storage.setItem(key, JSON.stringify(map));
};

const formatPeriod = (dateValue?: string) => {
  if (!dateValue) {
    return undefined;
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const buildEntry = (options: {
  debitAccount: string;
  creditAccount: string;
  amount: number;
  memo: string;
  effectiveDate?: string;
  period?: string;
  reverse?: boolean;
}): BookingEntry => {
  const amount = Math.abs(options.amount);
  const debit = options.reverse ? options.creditAccount : options.debitAccount;
  const credit = options.reverse ? options.debitAccount : options.creditAccount;
  return {
    memo: options.memo,
    effectiveDate: options.effectiveDate,
    period: options.period,
    lines: [
      { direction: "DEBIT", account: debit, amount },
      { direction: "CREDIT", account: credit, amount }
    ]
  };
};

const confidenceForCategory = (category: RootCauseCategory): RecommendationConfidence => {
  if (category === "VENDOR_RATE_ERROR") {
    return "Medium";
  }
  if (category === "OTHER") {
    return "Low";
  }
  return "High";
};

export const deriveRootCause = (input: RecommendationInput): RootCauseCategory => {
  const label = input.aiReason ?? (input.transaction ? getRootCauseLabel(input.transaction) : "");
  const normalized = label.toLowerCase();
  if (normalized.includes("timing")) {
    return "TIMING";
  }
  if (normalized.includes("pricing")) {
    return "VENDOR_RATE_ERROR";
  }
  if (normalized.includes("contract")) {
    return "MISCODED_ACCOUNT";
  }
  if (normalized.includes("quantity")) {
    return "DUPLICATE";
  }
  const variance = input.transaction?.variance ?? 0;
  if (variance < 0) {
    return "REVERSAL_MISSING";
  }
  return "MISSING_ACCRUAL";
};

const recommendationTemplates: Record<
  RootCauseCategory,
  (input: RecommendationInput) => Recommendation
> = {
  TIMING: (input) => {
    const amount = input.transaction?.variance ?? 0;
    const memo = "Accrue timing variance";
    return {
      id: "rec-timing",
      title: "Accrue timing variance",
      nextSteps: [
        "Check timing window",
        "Book accrual for variance",
        "Schedule reversal next period"
      ],
      bookingEntry: buildEntry({
        debitAccount: accountMap.expense,
        creditAccount: accountMap.accrued,
        amount,
        memo,
        effectiveDate: input.transaction?.postingDate,
        period: formatPeriod(input.transaction?.postingDate),
        reverse: amount < 0
      }),
      confidence: confidenceForCategory("TIMING"),
      rationale: "Timing gap likely",
      source: "rules"
    };
  },
  DUPLICATE: (input) => {
    const amount = input.transaction?.variance ?? 0;
    const memo = "Reverse duplicate charge";
    return {
      id: "rec-duplicate",
      title: "Reverse duplicate charge",
      nextSteps: [
        "Confirm duplicate transaction",
        "Reverse duplicate entry",
        "Notify vendor if needed"
      ],
      bookingEntry: buildEntry({
        debitAccount: accountMap.ap,
        creditAccount: accountMap.expense,
        amount,
        memo,
        effectiveDate: input.transaction?.postingDate,
        period: formatPeriod(input.transaction?.postingDate),
        reverse: amount < 0
      }),
      confidence: confidenceForCategory("DUPLICATE"),
      rationale: "Duplicate pattern detected",
      source: "rules"
    };
  },
  MISCODED_ACCOUNT: (input) => {
    const amount = input.transaction?.variance ?? 0;
    const memo = "Reclass miscodings";
    return {
      id: "rec-reclass",
      title: "Reclass account coding",
      nextSteps: ["Verify correct account", "Reclass entry", "Update vendor mapping"],
      bookingEntry: buildEntry({
        debitAccount: "Correct Expense",
        creditAccount: "Misclassified Expense",
        amount,
        memo,
        effectiveDate: input.transaction?.postingDate,
        period: formatPeriod(input.transaction?.postingDate),
        reverse: amount < 0
      }),
      confidence: confidenceForCategory("MISCODED_ACCOUNT"),
      rationale: "Account mismatch likely",
      source: "rules"
    };
  },
  MISSING_ACCRUAL: (input) => {
    const amount = input.transaction?.variance ?? 0;
    const memo = "Book missing accrual";
    return {
      id: "rec-missing-accrual",
      title: "Book missing accrual",
      nextSteps: ["Confirm service period", "Book accrual entry", "Schedule reversal"],
      bookingEntry: buildEntry({
        debitAccount: accountMap.expense,
        creditAccount: accountMap.accrued,
        amount,
        memo,
        effectiveDate: input.transaction?.postingDate,
        period: formatPeriod(input.transaction?.postingDate),
        reverse: amount < 0
      }),
      confidence: confidenceForCategory("MISSING_ACCRUAL"),
      rationale: "Accrual not recorded",
      source: "rules"
    };
  },
  REVERSAL_MISSING: (input) => {
    const amount = input.transaction?.variance ?? 0;
    const memo = "Record missing reversal";
    return {
      id: "rec-reversal",
      title: "Record missing reversal",
      nextSteps: ["Locate prior accrual", "Prepare reversal entry", "Verify period close"],
      bookingEntry: buildEntry({
        debitAccount: accountMap.accrued,
        creditAccount: accountMap.expense,
        amount,
        memo,
        effectiveDate: input.transaction?.postingDate,
        period: formatPeriod(input.transaction?.postingDate),
        reverse: amount < 0
      }),
      confidence: confidenceForCategory("REVERSAL_MISSING"),
      rationale: "Reversal not recorded",
      source: "rules"
    };
  },
  VENDOR_RATE_ERROR: (_input) => ({
    id: "rec-rate",
    title: "Validate vendor rate",
    nextSteps: ["Check contract rates", "Request vendor credit", "Update rate master"],
    confidence: confidenceForCategory("VENDOR_RATE_ERROR"),
    rationale: "Rate variance detected",
    source: "rules"
  }),
  FX_REVALUATION: (input) => {
    const amount = input.transaction?.variance ?? 0;
    const memo = "Record FX revaluation";
    return {
      id: "rec-fx",
      title: "Record FX revaluation",
      nextSteps: ["Confirm FX rate source", "Book revaluation entry", "Update FX policy"],
      bookingEntry: buildEntry({
        debitAccount: accountMap.fx,
        creditAccount: accountMap.intercompany,
        amount,
        memo,
        effectiveDate: input.transaction?.postingDate,
        period: formatPeriod(input.transaction?.postingDate),
        reverse: amount < 0
      }),
      confidence: confidenceForCategory("FX_REVALUATION"),
      rationale: "FX movement detected",
      source: "rules"
    };
  },
  OTHER: (_input) => ({
    id: "rec-other",
    title: "Review variance details",
    nextSteps: ["Review supporting evidence", "Confirm policy threshold", "Decide next action"],
    confidence: confidenceForCategory("OTHER"),
    rationale: "Needs analyst review",
    source: "rules"
  })
};

const recommendationCache = new Map<string, Recommendation[]>();

export const recommendFix = (input: RecommendationInput): Recommendation => {
  const rootCause = deriveRootCause(input);
  return recommendationTemplates[rootCause](input);
};

export const getRecommendationsForCase = (input: RecommendationInput): Recommendation[] => {
  const cacheKey = input.caseId;
  const cached = recommendationCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const primary = recommendFix(input);
  const tieBreaker = hashString(input.caseId);
  const secondary =
    tieBreaker % 4 === 0 ? recommendationTemplates.OTHER(input) : undefined;
  const recommendations = secondary ? [primary, secondary] : [primary];
  recommendationCache.set(cacheKey, recommendations);
  return recommendations;
};

export const getPrimaryRecommendation = (input: RecommendationInput) => {
  return getRecommendationsForCase(input)[0];
};

export const formatBookingEntry = (entry: BookingEntry) => {
  const lines = entry.lines
    .map((line) => `${line.direction}: ${line.account} ${line.amount.toFixed(2)}`)
    .join("\n");
  const meta = [
    entry.period ? `Period: ${entry.period}` : null,
    entry.effectiveDate ? `Date: ${entry.effectiveDate}` : null
  ]
    .filter(Boolean)
    .join(" · ");
  return [entry.memo, meta, lines].filter(Boolean).join("\n");
};

export const markRecommendationProposed = (caseId: string, recommendationId: string) => {
  const map = readStorageMap(STORAGE_KEY_PROPOSED);
  map[caseId] = recommendationId;
  writeStorageMap(STORAGE_KEY_PROPOSED, map);
};

export const getProposedRecommendationId = (caseId: string) => {
  const map = readStorageMap(STORAGE_KEY_PROPOSED);
  return map[caseId];
};

export const attachRecommendationToEscalation = (
  caseId: string,
  recommendation: Recommendation
) => {
  const map = readStorageMap(STORAGE_KEY_ESCALATION);
  map[caseId] = JSON.stringify(recommendation);
  writeStorageMap(STORAGE_KEY_ESCALATION, map);
};

export const getEscalationRecommendation = (caseId: string) => {
  const map = readStorageMap(STORAGE_KEY_ESCALATION);
  const raw = map[caseId];
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as Recommendation;
  } catch {
    return undefined;
  }
};
