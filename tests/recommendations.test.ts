import { describe, expect, it } from "vitest";
import {
  ENTRY_LESS_CATEGORIES,
  deriveRootCause,
  getRecommendationsForCase,
  recommendFix
} from "../src/utils/recommendations";
import { CaseStatus, ConfidenceBand } from "../src/types/case";
import type { TransactionRow } from "../src/types/transaction";

const tx = (overrides: Partial<TransactionRow> = {}): TransactionRow => ({
  transactionId: "TX-9000001",
  postingDate: "2025-10-24",
  vendor: "Demo Vendor",
  amount: 1000,
  variance: 100,
  confidenceScore: 0.9,
  caseId: "CASE-T1",
  status: CaseStatus.ScreenedUnresolved,
  confidenceBand: ConfidenceBand.High,
  reviewed: false,
  lastUpdated: "2025-10-24",
  ...overrides
});

const linesOf = (transaction: TransactionRow) =>
  recommendFix({ caseId: transaction.caseId, transaction }).bookingEntry?.lines.map(
    (line) => `${line.direction}:${line.account}`
  );

describe("recommendation inputs (acceptance check 4)", () => {
  it("creates no entry before the transaction loads", () => {
    expect(getRecommendationsForCase({ caseId: "CASE-LOADING" })).toEqual([]);
  });

  it("recomputes when transaction data arrives or changes", () => {
    getRecommendationsForCase({ caseId: "CASE-CACHE" });
    const first = getRecommendationsForCase({
      caseId: "CASE-CACHE",
      transaction: tx({ caseId: "CASE-CACHE", variance: 123, canonicalAiReason: "Duplicate Transaction" })
    })[0];
    expect(first.id).toBe("rec-duplicate");
    expect(first.bookingEntry?.lines[0].amount).toBe(123);

    const changed = getRecommendationsForCase({
      caseId: "CASE-CACHE",
      transaction: tx({ caseId: "CASE-CACHE", variance: 50, canonicalAiReason: "Duplicate Transaction" })
    })[0];
    expect(changed.bookingEntry?.lines[0].amount).toBe(50);
  });
});

describe("journal direction and journal eligibility (acceptance check 3)", () => {
  it("reverses a duplicate the same way regardless of variance sign", () => {
    const positive = linesOf(tx({ variance: 100, canonicalAiReason: "Duplicate Transaction" }));
    const negative = linesOf(tx({ variance: -100, canonicalAiReason: "Duplicate Transaction" }));
    expect(positive).toEqual(["DEBIT:Accounts Payable", "CREDIT:Expense"]);
    expect(negative).toEqual(positive);
  });

  it.each([
    "Stale Master Data",
    "Reference Data Misalignment",
    "Wrong PO Reference",
    "Batch Interface Failure",
    "Wrong Vendor Mapping",
    "Missing Receipt",
    "Conversion Error"
  ])("proposes no journal for %s until economic impact is established", (reason) => {
    const transaction = tx({ canonicalAiReason: reason });
    expect(ENTRY_LESS_CATEGORIES.has(deriveRootCause({ caseId: "x", transaction }))).toBe(true);
    expect(recommendFix({ caseId: "x", transaction }).bookingEntry).toBeUndefined();
  });

  it("never proposes an FX entry for a conversion error", () => {
    const rec = recommendFix({
      caseId: "x",
      transaction: tx({ canonicalAiReason: "Conversion Error" })
    });
    expect(JSON.stringify(rec)).not.toContain("FX Gain/Loss");
  });
});
