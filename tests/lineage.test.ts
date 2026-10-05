import { describe, expect, it } from "vitest";
import { MockDataProvider } from "../src/api/MockDataProvider";

describe("identifier and variance lineage (F17)", () => {
  it("keeps the source transaction and vendor IDs beside their display aliases", async () => {
    const provider = new MockDataProvider();
    const row = (await provider.getCases()).find((item) => item.caseId === "CASE-00038")!;
    expect(row.sourceTransactionId).toBe("TX-1000038");
    expect(row.sourceVendorId).toBe("VENDOR-008");
    expect(row.transactionId).not.toBe(row.sourceTransactionId);
  });

  it("keys match evidence on the source transaction ID, not the display alias", async () => {
    const provider = new MockDataProvider();
    const caseFile = await provider.getCase("CASE-00038");
    expect(caseFile.matchEvidence?.transactionId).toBe("TX-1000038");
  });

  it("reports the quantity difference separately from the monetary variance", async () => {
    const provider = new MockDataProvider();
    const row = (await provider.getCases()).find((item) => item.caseId === "CASE-00038")!;
    expect(row.variance).toBe(-169.47);
    expect(row.quantityDelta).toBe(-2);
  });
});
