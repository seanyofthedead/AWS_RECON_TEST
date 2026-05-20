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
  suspense: "Suspense / Clearing",
  grIr: "GR/IR Clearing",
  ppv: "PPV / COGS",
  fx: "FX Gain/Loss",
  intercompany: "Intercompany",
  correctExpense: "Correct Expense",
  misclassifiedExpense: "Misclassified Expense"
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

const buildMemo = (base: string, transaction?: TransactionRow) => {
  if (!transaction) {
    return base;
  }
  return `${base} · ${transaction.vendor} · ${transaction.transactionId}`;
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
  if (category === "OTHER") {
    return "Low";
  }
  if (
    category === "VENDOR_RATE_ERROR" ||
    category === "STALE_MASTER_DATA" ||
    category === "BATCH_INTERFACE" ||
    category === "REFERENCE_DATA" ||
    category === "WRONG_VENDOR_MAPPING"
  ) {
    return "Medium";
  }
  return "High";
};

const CANONICAL_TO_CATEGORY: Record<string, RootCauseCategory> = {
  "Timing Difference": "TIMING",
  "Accrual Reversal": "REVERSAL_MISSING",
  "Missing Receipt": "MISSING_RECEIPT",
  "Manual Entry Error": "MANUAL_ENTRY_ERROR",
  "Stale Master Data": "STALE_MASTER_DATA",
  "Reference Data Misalignment": "REFERENCE_DATA",
  "Wrong PO Reference": "WRONG_PO_REFERENCE",
  "Batch Interface Failure": "BATCH_INTERFACE",
  "Duplicate Transaction": "DUPLICATE",
  "Unit of Measure Mismatch": "UOM_MISMATCH",
  "Partial Posting": "PARTIAL_POSTING",
  "Wrong Vendor Mapping": "WRONG_VENDOR_MAPPING",
  "Price Variance": "PRICE_VARIANCE",
  "Conversion Error": "CONVERSION_ERROR",
  "Unknown / Needs Review": "OTHER",
  Other: "OTHER"
};

export const deriveRootCause = (input: RecommendationInput): RootCauseCategory => {
  if (input.transaction) {
    const canonical = getRootCauseLabel(input.transaction);
    const mapped = CANONICAL_TO_CATEGORY[canonical];
    if (mapped) {
      return mapped;
    }
  }
  const reason = input.aiReason?.trim() ?? "";
  if (reason && CANONICAL_TO_CATEGORY[reason]) {
    return CANONICAL_TO_CATEGORY[reason];
  }
  const normalized = reason.toLowerCase();
  if (normalized.includes("timing")) {
    return "TIMING";
  }
  if (normalized.includes("duplicate")) {
    return "DUPLICATE";
  }
  if (normalized.includes("receipt")) {
    return "MISSING_RECEIPT";
  }
  if (normalized.includes("price")) {
    return "PRICE_VARIANCE";
  }
  if (normalized.includes("uom") || normalized.includes("unit of measure")) {
    return "UOM_MISMATCH";
  }
  if (normalized.includes("conversion")) {
    return "CONVERSION_ERROR";
  }
  const variance = input.transaction?.variance ?? 0;
  if (variance < 0) {
    return "REVERSAL_MISSING";
  }
  return "MISSING_ACCRUAL";
};

type TemplateBuilder = (input: RecommendationInput) => Recommendation;

const makeBookedTemplate = (config: {
  category: RootCauseCategory;
  id: string;
  title: string;
  rationale: string;
  nextSteps: string[];
  debitAccount: string;
  creditAccount: string;
}): TemplateBuilder => {
  return (input) => {
    const amount = input.transaction?.variance ?? 0;
    return {
      id: config.id,
      title: config.title,
      nextSteps: config.nextSteps,
      bookingEntry: buildEntry({
        debitAccount: config.debitAccount,
        creditAccount: config.creditAccount,
        amount,
        memo: buildMemo(config.title, input.transaction),
        effectiveDate: input.transaction?.postingDate,
        period: formatPeriod(input.transaction?.postingDate),
        reverse: amount < 0
      }),
      confidence: confidenceForCategory(config.category),
      rationale: config.rationale,
      source: "rules"
    };
  };
};

const recommendationTemplates: Record<RootCauseCategory, TemplateBuilder> = {
  TIMING: makeBookedTemplate({
    category: "TIMING",
    id: "rec-timing",
    title: "Accrue timing variance",
    rationale: "Posting straddles period close",
    nextSteps: [
      "Confirm service period extends across close",
      "Book accrual for variance",
      "Schedule reversal next period"
    ],
    debitAccount: accountMap.expense,
    creditAccount: accountMap.accrued
  }),
  DUPLICATE: makeBookedTemplate({
    category: "DUPLICATE",
    id: "rec-duplicate",
    title: "Reverse duplicate charge",
    rationale: "Same invoice posted more than once",
    nextSteps: [
      "Confirm both postings reference the same invoice",
      "Reverse duplicate entry",
      "Notify vendor if remittance already sent"
    ],
    debitAccount: accountMap.ap,
    creditAccount: accountMap.expense
  }),
  REVERSAL_MISSING: makeBookedTemplate({
    category: "REVERSAL_MISSING",
    id: "rec-reversal",
    title: "Record missing accrual reversal",
    rationale: "Prior period accrual not reversed",
    nextSteps: [
      "Locate prior accrual entry",
      "Prepare reversal entry",
      "Verify period is still open for posting"
    ],
    debitAccount: accountMap.accrued,
    creditAccount: accountMap.expense
  }),
  MISSING_RECEIPT: makeBookedTemplate({
    category: "MISSING_RECEIPT",
    id: "rec-missing-receipt",
    title: "Clear GR/IR for missing receipt",
    rationale: "Goods received but no receipt posted",
    nextSteps: [
      "Confirm goods received with receiving team",
      "Post receipt in receiving system",
      "Match invoice to receipt and clear GR/IR"
    ],
    debitAccount: accountMap.grIr,
    creditAccount: accountMap.ap
  }),
  MANUAL_ENTRY_ERROR: makeBookedTemplate({
    category: "MANUAL_ENTRY_ERROR",
    id: "rec-manual-entry",
    title: "Correct manual entry error",
    rationale: "Keying error in original posting",
    nextSteps: [
      "Compare keyed amount against source document",
      "Reverse incorrect line",
      "Re-post with correct amount"
    ],
    debitAccount: accountMap.expense,
    creditAccount: accountMap.ap
  }),
  STALE_MASTER_DATA: makeBookedTemplate({
    category: "STALE_MASTER_DATA",
    id: "rec-stale-master",
    title: "Refresh vendor master data",
    rationale: "Vendor master data is out of date",
    nextSteps: [
      "Verify vendor master against latest source",
      "Refresh master data feed",
      "Re-evaluate variance after refresh"
    ],
    debitAccount: accountMap.suspense,
    creditAccount: accountMap.ap
  }),
  REFERENCE_DATA: makeBookedTemplate({
    category: "REFERENCE_DATA",
    id: "rec-reference-data",
    title: "Reclass to Suspense pending mapping fix",
    rationale: "Mapping codes inconsistent across systems",
    nextSteps: [
      "Identify mapping codes that disagree across systems",
      "Reclass posting to Suspense / Clearing",
      "Re-post once reference data is realigned"
    ],
    debitAccount: accountMap.suspense,
    creditAccount: accountMap.ap
  }),
  WRONG_PO_REFERENCE: makeBookedTemplate({
    category: "WRONG_PO_REFERENCE",
    id: "rec-wrong-po",
    title: "Re-link invoice to correct PO",
    rationale: "Invoice references different PO than recorded",
    nextSteps: [
      "Verify invoice PO with vendor or procurement",
      "Reverse posting against the incorrect PO",
      "Re-post against the correct PO"
    ],
    debitAccount: accountMap.suspense,
    creditAccount: accountMap.ap
  }),
  BATCH_INTERFACE: makeBookedTemplate({
    category: "BATCH_INTERFACE",
    id: "rec-batch-interface",
    title: "Re-run failed batch interface",
    rationale: "Inbound batch interface did not post",
    nextSteps: [
      "Inspect batch interface log for the failure",
      "Re-submit the failed batch",
      "Confirm posting lands in the target ledger"
    ],
    debitAccount: accountMap.suspense,
    creditAccount: accountMap.ap
  }),
  UOM_MISMATCH: makeBookedTemplate({
    category: "UOM_MISMATCH",
    id: "rec-uom",
    title: "Re-rate UoM and post adjustment",
    rationale: "Quantity unit differs between PO and invoice",
    nextSteps: [
      "Confirm unit of measure on PO versus invoice",
      "Re-rate quantity to the canonical UoM",
      "Post UoM-aligned adjustment"
    ],
    debitAccount: accountMap.ppv,
    creditAccount: accountMap.ap
  }),
  PARTIAL_POSTING: makeBookedTemplate({
    category: "PARTIAL_POSTING",
    id: "rec-partial-posting",
    title: "Complete partial posting",
    rationale: "Posting partially landed; remainder outstanding",
    nextSteps: [
      "Identify lines that did not post",
      "Submit missing lines to GL",
      "Reconcile after partial posting clears"
    ],
    debitAccount: accountMap.expense,
    creditAccount: accountMap.accrued
  }),
  WRONG_VENDOR_MAPPING: makeBookedTemplate({
    category: "WRONG_VENDOR_MAPPING",
    id: "rec-wrong-vendor",
    title: "Reassign to correct vendor",
    rationale: "Posted against the wrong vendor master record",
    nextSteps: [
      "Identify the correct vendor master record",
      "Reverse posting against the wrong vendor",
      "Re-post against the correct vendor"
    ],
    debitAccount: accountMap.suspense,
    creditAccount: accountMap.ap
  }),
  PRICE_VARIANCE: makeBookedTemplate({
    category: "PRICE_VARIANCE",
    id: "rec-price-variance",
    title: "Book price variance to PPV",
    rationale: "Invoice price differs from PO / contract price",
    nextSteps: [
      "Confirm invoice price against contract",
      "Post price variance to PPV / COGS",
      "Request vendor credit if price contradicts contract"
    ],
    debitAccount: accountMap.ppv,
    creditAccount: accountMap.ap
  }),
  CONVERSION_ERROR: makeBookedTemplate({
    category: "CONVERSION_ERROR",
    id: "rec-conversion-error",
    title: "Adjust for conversion error",
    rationale: "Conversion factor misapplied",
    nextSteps: [
      "Confirm conversion factor used at posting",
      "Reverse mis-converted posting",
      "Re-post with the correct conversion"
    ],
    debitAccount: accountMap.fx,
    creditAccount: accountMap.ap
  }),
  MISSING_ACCRUAL: makeBookedTemplate({
    category: "MISSING_ACCRUAL",
    id: "rec-missing-accrual",
    title: "Book missing accrual",
    rationale: "Accrual not recorded for known liability",
    nextSteps: [
      "Confirm service period",
      "Book accrual entry",
      "Schedule reversal next period"
    ],
    debitAccount: accountMap.expense,
    creditAccount: accountMap.accrued
  }),
  MISCODED_ACCOUNT: makeBookedTemplate({
    category: "MISCODED_ACCOUNT",
    id: "rec-reclass",
    title: "Reclass account coding",
    rationale: "Posting hit the wrong account code",
    nextSteps: [
      "Verify the correct account",
      "Reclass entry to the correct account",
      "Update vendor or product mapping"
    ],
    debitAccount: accountMap.correctExpense,
    creditAccount: accountMap.misclassifiedExpense
  }),
  FX_REVALUATION: makeBookedTemplate({
    category: "FX_REVALUATION",
    id: "rec-fx",
    title: "Record FX revaluation",
    rationale: "FX movement detected against booked amount",
    nextSteps: [
      "Confirm FX rate source",
      "Book revaluation entry",
      "Update FX policy if needed"
    ],
    debitAccount: accountMap.fx,
    creditAccount: accountMap.intercompany
  }),
  VENDOR_RATE_ERROR: (_input) => ({
    id: "rec-rate",
    title: "Validate vendor rate",
    nextSteps: [
      "Check contract rates",
      "Request vendor credit if applicable",
      "Update rate master"
    ],
    confidence: confidenceForCategory("VENDOR_RATE_ERROR"),
    rationale: "Rate variance detected",
    source: "rules"
  }),
  OTHER: (_input) => ({
    id: "rec-other",
    title: "Review variance details",
    nextSteps: [
      "Review supporting evidence",
      "Confirm policy threshold",
      "Decide next action"
    ],
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

export const ENTRY_LESS_CATEGORIES: ReadonlySet<RootCauseCategory> = new Set([
  "VENDOR_RATE_ERROR",
  "OTHER"
]);
