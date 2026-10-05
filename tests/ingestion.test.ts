import { describe, expect, it, vi } from "vitest";
import { MockDataProvider } from "../src/api/MockDataProvider";
import { validateTransactionRows } from "../src/utils/ingestion";

const row = (overrides: Record<string, string> = {}) => ({
  TransactionID: "TX-1000013",
  Vendor: "VENDOR-001",
  PostingDate: "2025-10-01",
  Amount: "1000.00",
  Variance: "25.00",
  Confidence: "0.8",
  ...overrides
});

describe("transaction ingestion (acceptance check 8)", () => {
  it("rejects malformed amounts instead of turning them into zero", () => {
    const report = validateTransactionRows([row({ Amount: "12,34x" })]);
    expect(report.accepted).toHaveLength(0);
    expect(report.rejected[0].reasons).toContain("Amount is not a number: \"12,34x\"");
  });

  it("rejects missing or invalid posting dates instead of using today", () => {
    const report = validateTransactionRows([
      row({ TransactionID: "TX-1000013", PostingDate: "" }),
      row({ TransactionID: "TX-1000014", PostingDate: "2025-13-45" })
    ]);
    expect(report.accepted).toHaveLength(0);
    expect(report.rejected.map((item) => item.reasons[0])).toEqual([
      "PostingDate is missing",
      "PostingDate is not a valid date: \"2025-13-45\""
    ]);
  });

  it("rejects confidence outside 0 to 1 and missing transaction IDs", () => {
    const report = validateTransactionRows([
      row({ Confidence: "1.7" }),
      row({ TransactionID: "" })
    ]);
    expect(report.rejected.map((item) => item.reasons[0])).toEqual([
      "Confidence must be between 0 and 1: \"1.7\"",
      "TransactionID is missing"
    ]);
  });

  it("reports duplicate transaction IDs as exceptions, keeping the first row", () => {
    const report = validateTransactionRows([
      row({ Amount: "1000.00" }),
      row({ Amount: "999.00" })
    ]);
    expect(report.accepted).toHaveLength(1);
    expect(report.accepted[0].Amount).toBe("1000.00");
    expect(report.duplicates).toEqual([
      { line: 3, transactionId: "TX-1000013", amount: 999, firstLine: 2 }
    ]);
  });

  it("rejects rows outside the expected case range rather than dropping them", () => {
    const report = validateTransactionRows([row({ TransactionID: "TX-1000200" })], {
      minCaseIndex: 13,
      maxCaseIndex: 100
    });
    expect(report.rejected[0].reasons).toEqual([
      "TransactionID TX-1000200 is outside the expected case range 13-100"
    ]);
  });

  it("reconciles source counts and amounts with accepted, rejected, and duplicate rows", () => {
    const report = validateTransactionRows([
      row({ TransactionID: "TX-1000013", Amount: "100.10" }),
      row({ TransactionID: "TX-1000014", Amount: "200.20", PostingDate: "" }),
      row({ TransactionID: "TX-1000013", Amount: "300.30" }),
      row({ TransactionID: "TX-1000015", Amount: "oops" })
    ]);
    expect(report.totals).toEqual({
      sourceRows: 4,
      acceptedRows: 1,
      rejectedRows: 2,
      duplicateRows: 1,
      sourceAmount: 600.6,
      acceptedAmount: 100.1,
      rejectedAmount: 200.2,
      duplicateAmount: 300.3,
      unparseableAmountRows: 1
    });
  });
});

describe("provider ingestion", () => {
  it("accepts every baseline fixture row and reports reconciled totals", async () => {
    const provider = new MockDataProvider();
    await provider.getCases();
    const report = provider.getIngestionReport();
    expect(report.totals.sourceRows).toBe(88);
    expect(report.totals.acceptedRows).toBe(88);
    expect(report.rejected).toEqual([]);
    expect(report.duplicates).toEqual([]);
    expect(report.parseErrors).toEqual([]);
  });

  it("fails loudly when a data file cannot be fetched", async () => {
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 503, text: async () => "" }));
    try {
      const provider = new MockDataProvider();
      await expect(provider.getCases()).rejects.toThrow(/\/data\/ui_transactions\.csv.*503/);
    } finally {
      vi.stubGlobal("fetch", realFetch);
    }
  });

  it("validates imported batches and reports their rejected rows", async () => {
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string) => {
      const response = await realFetch(url);
      if (!url.endsWith("ui_transactions_batch_1.csv")) return response;
      const text = await response.text();
      // Corrupt the first data row's Amount column.
      const lines = text.split(/\r?\n/);
      const cells = lines[1].split(",");
      cells[3] = "N/A";
      lines[1] = cells.join(",");
      return { ok: true, status: 200, text: async () => lines.join("\n") };
    });
    try {
      const provider = new MockDataProvider();
      await provider.getCases();
      const result = await provider.importNextBatch(1);
      expect(result.importedCount).toBe(11);
      const report = provider.getIngestionReport("batch-1");
      expect(report.rejected).toEqual([
        { line: 2, transactionId: "TX-1000001", reasons: ['Amount is not a number: "N/A"'] }
      ]);
      expect(report.totals.acceptedRows).toBe(11);
    } finally {
      vi.stubGlobal("fetch", realFetch);
    }
  });
});
