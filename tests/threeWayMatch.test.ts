import { describe, expect, it } from "vitest";
import { evaluateThreeWayMatch } from "../src/utils/threeWayMatch";

const linked = {
  transactionId: "TX-1",
  invoiceId: "INV-1",
  poNumber: "PO-1",
  invoicePoNumber: "PO-1",
  receiptId: "RCPT-1",
  receiptPoNumber: "PO-1",
  glDocumentId: "GL-1",
  glInvoiceId: "INV-1",
  poAmount: "100.00",
  receiptAmount: "100.00",
  glAmount: "100.00",
  monetaryVariance: "0"
};

describe("three-way match (acceptance check 1)", () => {
  it("passes only when references and amounts agree with no unexplained variance", () => {
    const result = evaluateThreeWayMatch(linked);
    expect(result.status).toBe("pass");
    expect(result.referenceStatus).toBe("pass");
    expect(result.amountStatus).toBe("pass");
  });

  it("fails when IDs match but economic fields disagree", () => {
    const result = evaluateThreeWayMatch({ ...linked, receiptAmount: "1", glAmount: "999" });
    expect(result.referenceStatus).toBe("pass");
    expect(result.amountStatus).toBe("fail");
    expect(result.status).toBe("fail");
  });

  it("does not let a missing invoice PO reference confirm itself", () => {
    const result = evaluateThreeWayMatch({ ...linked, invoicePoNumber: undefined });
    expect(result.status).toBe("inconclusive");
  });

  it("stays inconclusive when the receipt or GL document is missing", () => {
    expect(
      evaluateThreeWayMatch({ ...linked, receiptId: undefined, receiptNumber: undefined }).status
    ).toBe("inconclusive");
    expect(
      evaluateThreeWayMatch({ ...linked, glDocumentId: undefined, glPostingId: undefined }).status
    ).toBe("inconclusive");
  });

  it("is inconclusive when amounts agree but a monetary variance is unexplained", () => {
    const result = evaluateThreeWayMatch({ ...linked, monetaryVariance: "214.64" });
    expect(result.amountStatus).toBe("inconclusive");
    expect(result.status).toBe("inconclusive");
  });

  it("reports the original audit false-pass input as not passing", () => {
    const result = evaluateThreeWayMatch({
      transactionId: "test",
      invoiceId: "I",
      poNumber: "P",
      receiptPoNumber: "P",
      glInvoiceId: "I",
      poAmount: "100",
      receiptAmount: "1",
      glAmount: "999"
    });
    expect(result.status).not.toBe("pass");
  });
});
