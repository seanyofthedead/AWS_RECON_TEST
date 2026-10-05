import { describe, expect, it } from "vitest";
import {
  ENTRY_LESS_CATEGORIES,
  deriveRootCause,
  getRecommendationsForCase,
  recommendFix
} from "../src/utils/recommendations";
import { CaseStatus, ConfidenceBand } from "../src/types/case";
import type { TransactionRow } from "../src/types/transaction";

// Every canonical root cause, with positive, negative, zero, and missing-input
// scenarios (acceptance check 3). Expected outcomes encode the demo's rules;
// an accounting owner still needs to approve them for production use.
const REASONS = [
  "Timing Difference",
  "Accrual Reversal",
  "Missing Receipt",
  "Manual Entry Error",
  "Stale Master Data",
  "Reference Data Misalignment",
  "Wrong PO Reference",
  "Batch Interface Failure",
  "Duplicate Transaction",
  "Unit of Measure Mismatch",
  "Partial Posting",
  "Wrong Vendor Mapping",
  "Price Variance",
  "Conversion Error",
  "Unknown / Needs Review"
];

const tx = (reason: string, variance: number): TransactionRow => ({
  transactionId: "TX-9000001",
  postingDate: "2025-10-24",
  vendor: "Demo Vendor",
  amount: 1000,
  variance,
  confidenceScore: 0.9,
  caseId: `CASE-${reason}-${variance}`,
  status: CaseStatus.ScreenedUnresolved,
  confidenceBand: ConfidenceBand.High,
  reviewed: false,
  lastUpdated: "2025-10-24",
  canonicalAiReason: reason
});

describe.each(REASONS)("%s", (reason) => {
  const category = deriveRootCause({ caseId: "x", transaction: tx(reason, 100) });
  const entryLess = ENTRY_LESS_CATEGORIES.has(category);

  it("proposes no journal for a zero variance", () => {
    expect(recommendFix({ caseId: "z", transaction: tx(reason, 0) }).bookingEntry).toBeUndefined();
  });

  it("proposes nothing before the transaction is known", () => {
    expect(getRecommendationsForCase({ caseId: `missing-${reason}` })).toEqual([]);
  });

  it.each([100, -100])("handles a variance of %d", (variance) => {
    const entry = recommendFix({ caseId: "v", transaction: tx(reason, variance) }).bookingEntry;
    if (entryLess) {
      expect(entry).toBeUndefined();
      return;
    }
    expect(entry).toBeDefined();
    const [debit, credit] = entry!.lines;
    // Two balanced lines for the absolute variance, on different accounts.
    expect(debit.direction).toBe("DEBIT");
    expect(credit.direction).toBe("CREDIT");
    expect(debit.amount).toBe(Math.abs(variance));
    expect(credit.amount).toBe(debit.amount);
    expect(debit.account).not.toBe(credit.account);
  });

  it("flips direction with the variance sign unless the correction has a fixed direction", () => {
    const positive = recommendFix({ caseId: "p", transaction: tx(reason, 100) }).bookingEntry;
    const negative = recommendFix({ caseId: "n", transaction: tx(reason, -100) }).bookingEntry;
    if (!positive || !negative) return;
    const flipped = positive.lines[0].account === negative.lines[1].account;
    expect(flipped).toBe(category !== "DUPLICATE");
  });
});
