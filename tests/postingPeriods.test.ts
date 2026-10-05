import { describe, expect, it } from "vitest";
import { formatBookingEntry, recommendFix } from "../src/utils/recommendations";
import { fiscalYearOf, periodStatus } from "../src/utils/fiscalCalendar";
import { CaseStatus, ConfidenceBand } from "../src/types/case";
import type { TransactionRow } from "../src/types/transaction";

const tx = (overrides: Partial<TransactionRow> = {}): TransactionRow => ({
  transactionId: "TX-9000001",
  postingDate: "2025-10-24",
  vendor: "Demo Vendor",
  amount: 1000,
  variance: 100,
  confidenceScore: 0.9,
  caseId: "CASE-PP",
  status: CaseStatus.ScreenedUnresolved,
  confidenceBand: ConfidenceBand.High,
  reviewed: false,
  lastUpdated: "2025-10-24",
  ...overrides
});

const entryFor = (reason: string, postingDate: string) =>
  recommendFix({
    caseId: `CASE-${reason}-${postingDate}`,
    transaction: tx({ postingDate, canonicalAiReason: reason, rootCauseBucket: undefined })
  }).bookingEntry!;

describe("fiscal calendar", () => {
  it("uses the federal fiscal year starting in October", () => {
    expect(fiscalYearOf("2025-09-30")).toBe(2025);
    expect(fiscalYearOf("2025-10-01")).toBe(2026);
  });

  it("treats FY2025 periods as closed in the demo calendar", () => {
    expect(periodStatus("2025-09")).toBe("closed");
    expect(periodStatus("2025-10")).toBe("open");
  });
});

describe("posting period and reversal (F07)", () => {
  it("keeps service period, posting period, and effective date separate in an open period", () => {
    const entry = entryFor("Timing Difference", "2025-10-24");
    expect(entry.servicePeriod).toBe("2025-10");
    expect(entry.period).toBe("2025-10");
    expect(entry.effectiveDate).toBe("2025-10-24");
    expect(entry.fiscalYear).toBe(2026);
    expect(entry.priorPeriodAdjustment).toBe(false);
  });

  it("never backdates into a closed period; it posts in the first open period as a prior-period adjustment", () => {
    const entry = entryFor("Timing Difference", "2025-09-08");
    expect(entry.servicePeriod).toBe("2025-09");
    expect(entry.period).toBe("2025-10");
    expect(entry.effectiveDate).toBe("2025-10-01");
    expect(entry.fiscalYear).toBe(2026);
    expect(entry.priorPeriodAdjustment).toBe(true);
  });

  it("schedules the reversal of an accrual for the first day of the next period", () => {
    expect(entryFor("Timing Difference", "2025-10-24").reversal).toEqual({
      period: "2025-11",
      date: "2025-11-01"
    });
    expect(entryFor("Timing Difference", "2025-09-08").reversal).toEqual({
      period: "2025-11",
      date: "2025-11-01"
    });
  });

  it("does not schedule a reversal for a correction that is not an accrual", () => {
    expect(entryFor("Duplicate Transaction", "2025-10-24").reversal).toBeUndefined();
  });

  it("includes the posting schedule in the copied entry text", () => {
    const text = formatBookingEntry(entryFor("Timing Difference", "2025-09-08"));
    expect(text).toContain("Service period: 2025-09");
    expect(text).toContain("Posting period: 2025-10 (FY2026)");
    expect(text).toContain("Effective: 2025-10-01");
    expect(text).toContain("Prior-period adjustment: requires approval");
    expect(text).toContain("Reversal: 2025-11-01");
  });
});
