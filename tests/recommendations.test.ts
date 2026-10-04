import { describe, expect, it } from "vitest";
import {
  ENTRY_LESS_CATEGORIES,
  RULES_VERSION,
  attachRecommendationToEscalation,
  getEscalationRecommendation,
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

describe("escalation snapshots", () => {
  const ESCALATION_KEY = "recon_recommendation_escalation_v1";
  const transaction = tx({ caseId: "CASE-ESC", canonicalAiReason: "Duplicate Transaction" });
  const current = () => recommendFix({ caseId: "CASE-ESC", transaction });

  it("stamps new snapshots with the current rules version", () => {
    attachRecommendationToEscalation("CASE-ESC", current());
    const attachment = getEscalationRecommendation("CASE-ESC");
    expect(attachment?.stale).toBe(false);
    expect(attachment?.rulesVersion).toBe(RULES_VERSION);
    expect(attachment?.recommendation).toEqual(current());
  });

  it("flags legacy unstamped snapshots as stale without rewriting them", () => {
    const legacy = {
      ...current(),
      title: "Old posting-ready fix",
      bookingEntry: {
        memo: "old",
        lines: [{ direction: "DEBIT", account: "Expense", amount: 100 }]
      }
    };
    const stored = JSON.stringify({ "CASE-ESC": JSON.stringify(legacy) });
    localStorage.setItem(ESCALATION_KEY, stored);

    const attachment = getEscalationRecommendation("CASE-ESC");
    expect(attachment?.stale).toBe(true);
    expect(attachment?.recommendation.title).toBe("Old posting-ready fix");
    expect(localStorage.getItem(ESCALATION_KEY)).toBe(stored);
  });

  it("flags snapshots from another rules version as stale", () => {
    const snapshot = { rulesVersion: "2025-01-01", attachedAt: "2025-01-02T00:00:00Z", recommendation: current() };
    localStorage.setItem(ESCALATION_KEY, JSON.stringify({ "CASE-ESC": JSON.stringify(snapshot) }));
    expect(getEscalationRecommendation("CASE-ESC")?.stale).toBe(true);
  });

  it("ignores corrupt snapshots", () => {
    localStorage.setItem(ESCALATION_KEY, JSON.stringify({ "CASE-ESC": "{not json", "CASE-X": "42" }));
    expect(getEscalationRecommendation("CASE-ESC")).toBeUndefined();
    expect(getEscalationRecommendation("CASE-X")).toBeUndefined();
  });
});

describe("zero variance", () => {
  it("proposes no journal entry", () => {
    const rec = recommendFix({
      caseId: "CASE-ZERO",
      transaction: { variance: 0, canonicalAiReason: "Timing Difference" } as never
    });
    expect(rec.bookingEntry).toBeUndefined();
  });
});
