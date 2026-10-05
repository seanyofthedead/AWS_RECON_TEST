import { describe, expect, it } from "vitest";
import { MockDataProvider } from "../src/api/MockDataProvider";
import { CaseStatus } from "../src/types/case";

const RATIONALE = "Needs procurement confirmation of the PO.";

const firstOpenCaseId = async (provider: MockDataProvider) =>
  (await provider.getCases()).find((row) => row.status === CaseStatus.ScreenedUnresolved)!.caseId;

describe("decision log (F12)", () => {
  it("records the signed-in user as the reviewer", async () => {
    const provider = new MockDataProvider();
    provider.setActor({ id: "sub-123", name: "analyst@example.gov" });
    const caseId = await firstOpenCaseId(provider);
    const decision = await provider.reviewCase(caseId, {
      decisionType: "ESCALATE",
      reasonCode: "NEEDS_HUMAN_REVIEW",
      rationale: RATIONALE,
      evidenceIds: []
    });
    expect(decision.reviewer).toBe("analyst@example.gov");
    expect(decision.reviewerId).toBe("sub-123");
  });

  it("labels decisions made without a signed-in user instead of inventing one", async () => {
    const provider = new MockDataProvider();
    const caseId = await firstOpenCaseId(provider);
    const decision = await provider.reviewCase(caseId, {
      decisionType: "ESCALATE",
      reasonCode: "NEEDS_HUMAN_REVIEW",
      rationale: RATIONALE,
      evidenceIds: []
    });
    expect(decision.reviewer).toBe("Unidentified user");
    expect(decision.reviewerId).toBeUndefined();
  });

  it("versions each case by its recorded decisions", async () => {
    const provider = new MockDataProvider();
    const caseId = await firstOpenCaseId(provider);
    expect((await provider.getCase(caseId)).version).toBe(0);
    await provider.reviewCase(caseId, {
      decisionType: "ESCALATE",
      reasonCode: "NEEDS_HUMAN_REVIEW",
      rationale: RATIONALE,
      evidenceIds: [],
      expectedVersion: 0
    });
    expect((await provider.getCase(caseId)).version).toBe(1);
  });

  it("rejects a decision from a stale view instead of overwriting another tab's decision", async () => {
    const tabA = new MockDataProvider();
    const tabB = new MockDataProvider();
    const caseId = await firstOpenCaseId(tabA);
    const viewA = await tabA.getCase(caseId);
    const viewB = await tabB.getCase(caseId);

    await tabA.reviewCase(caseId, {
      decisionType: "ESCALATE",
      reasonCode: "NEEDS_HUMAN_REVIEW",
      rationale: RATIONALE,
      evidenceIds: [],
      expectedVersion: viewA.version
    });
    await expect(
      tabB.reviewCase(caseId, {
        decisionType: "OVERRIDE",
        reasonCode: "OTHER",
        rationale: "Overriding without seeing the escalation.",
        evidenceIds: [],
        expectedVersion: viewB.version
      })
    ).rejects.toThrow(/changed since you opened it/);
    expect((await new MockDataProvider().getCase(caseId)).status).toBe(CaseStatus.Escalated);
  });
});
