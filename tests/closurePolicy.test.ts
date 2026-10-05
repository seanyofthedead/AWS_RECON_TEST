import { describe, expect, it } from "vitest";
import { MockDataProvider } from "../src/api/MockDataProvider";
import { CaseStatus } from "../src/types/case";
import { describeClosure, planEscalateWithFix } from "../src/utils/closurePolicy";
import { evaluateThreeWayMatch } from "../src/utils/threeWayMatch";

const RATIONALE = "Reviewer accepts the PO mismatch as a documented exception.";

describe("escalating with a fix", () => {
  it("attaches the fix directly when the case is already escalated", () => {
    expect(planEscalateWithFix(CaseStatus.Escalated)).toBe("ATTACH_ONLY");
  });

  it("escalates first when the case is not yet escalated", () => {
    expect(planEscalateWithFix(CaseStatus.ScreenedUnresolved)).toBe("ESCALATE_THEN_ATTACH");
    expect(planEscalateWithFix(CaseStatus.Reviewed)).toBe("ESCALATE_THEN_ATTACH");
  });
});

describe("closing an escalated case with a failed match", () => {
  it("lets the escalation reviewer close it as a documented exception", async () => {
    const provider = new MockDataProvider();
    const caseFile = await provider.getCase("CASE-00013");
    expect(caseFile.status).toBe(CaseStatus.Escalated);
    expect(evaluateThreeWayMatch(caseFile.matchEvidence).status).toBe("fail");
    const invoice = caseFile.evidence.find((item) => item.title === "Invoice")!;

    const decision = await provider.reviewCase("CASE-00013", {
      decisionType: "CLOSE_AS_RESOLVED",
      reasonCode: "OTHER",
      rationale: RATIONALE,
      evidenceIds: [invoice.id]
    });

    expect(decision.disposition).toBe("DOCUMENTED_EXCEPTION");
    const closed = await provider.getCase("CASE-00013");
    expect(closed.status).toBe(CaseStatus.Resolved);
    expect(closed.closedByAnalyst).toBe(true);
    const row = (await provider.getCases()).find((item) => item.caseId === "CASE-00013")!;
    expect(row.closedByAnalyst).toBe(true);
  });
});

describe("closures recorded before dispositions were tracked", () => {
  it("are labeled as analyst closures, not seeded demo closures", async () => {
    const seeded = new MockDataProvider();
    const rows = await seeded.getCases();
    const open = rows.find((row) => row.status === CaseStatus.ScreenedUnresolved)!;
    const seededClosed = rows.find((row) => row.status === CaseStatus.Resolved)!;
    // The decision format saved before this change had no disposition.
    localStorage.setItem(
      "recon_review_decisions_v1",
      JSON.stringify([
        {
          caseId: open.caseId,
          decisionType: "CLOSE_AS_RESOLVED",
          reasonCode: "POLICY_MATCH",
          rationale: "Resolved with high confidence.",
          evidenceIds: [],
          reviewer: "UI Analyst",
          timestamp: "2026-09-30T12:00:00.000Z"
        }
      ])
    );

    const provider = new MockDataProvider();
    const reloaded = await provider.getCases();
    const legacyRow = reloaded.find((row) => row.caseId === open.caseId)!;
    const legacyCase = await provider.getCase(open.caseId);
    const seededRow = reloaded.find((row) => row.caseId === seededClosed.caseId)!;

    expect(legacyRow.status).toBe(CaseStatus.Resolved);
    expect(describeClosure(legacyRow)).toBe("Analyst closure (disposition not recorded)");
    expect(describeClosure(legacyCase)).toBe("Analyst closure (disposition not recorded)");
    expect(describeClosure(seededRow)).toBe("Seeded demo closure");
  });

  it("labels recorded dispositions", () => {
    expect(describeClosure({ closureDisposition: "MATCH_CONFIRMED" })).toBe("Match confirmed");
    expect(describeClosure({ closureDisposition: "DOCUMENTED_EXCEPTION" })).toBe(
      "Documented exception"
    );
  });
});
