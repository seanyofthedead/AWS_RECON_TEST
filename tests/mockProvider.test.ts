import { describe, expect, it } from "vitest";
import { MockDataProvider } from "../src/api/MockDataProvider";
import { CaseStatus } from "../src/types/case";
import { evaluateThreeWayMatch } from "../src/utils/threeWayMatch";

const RATIONALE = "Variance traced to vendor credit memo on file.";

const firstOpenCase = async (provider: MockDataProvider) => {
  const rows = await provider.getCases();
  const row = rows.find((item) => item.status === CaseStatus.ScreenedUnresolved);
  if (!row) {
    throw new Error("fixture has no open case");
  }
  return provider.getCase(row.caseId);
};

describe("closure prerequisites (acceptance check 2)", () => {
  it("rejects closure without rationale or evidence", async () => {
    const provider = new MockDataProvider();
    const caseFile = await firstOpenCase(provider);
    await expect(
      provider.reviewCase(caseFile.caseId, {
        decisionType: "CLOSE_AS_RESOLVED",
        reasonCode: "POLICY_MATCH",
        rationale: "",
        evidenceIds: []
      })
    ).rejects.toThrow(/Rationale/);
    await expect(
      provider.reviewCase(caseFile.caseId, { decision: "ACCEPT", rationaleText: RATIONALE })
    ).rejects.toThrow(/evidence/);
    expect((await provider.getCase(caseFile.caseId)).status).toBe(CaseStatus.ScreenedUnresolved);
  });

  it("rejects evidence from another case", async () => {
    const provider = new MockDataProvider();
    const caseFile = await firstOpenCase(provider);
    await expect(
      provider.reviewCase(caseFile.caseId, {
        decisionType: "CLOSE_AS_RESOLVED",
        reasonCode: "OTHER",
        rationale: RATIONALE,
        evidenceIds: ["CASE-99999-evidence-invoice"]
      })
    ).rejects.toThrow(/does not belong/);
  });

  it("records an unconfirmed match as a documented exception with residual variance", async () => {
    const provider = new MockDataProvider();
    const caseFile = await firstOpenCase(provider);
    const row = (await provider.getCases()).find((item) => item.caseId === caseFile.caseId)!;
    const decision = await provider.reviewCase(caseFile.caseId, {
      decisionType: "CLOSE_AS_RESOLVED",
      reasonCode: "OTHER",
      rationale: RATIONALE,
      evidenceIds: [caseFile.evidence[0].id]
    });
    expect(evaluateThreeWayMatch(caseFile.matchEvidence).status).not.toBe("pass");
    expect(decision.disposition).toBe("DOCUMENTED_EXCEPTION");
    expect(decision.residualVariance).toBe(row.variance);
    const closed = await provider.getCase(caseFile.caseId);
    expect(closed.status).toBe(CaseStatus.Resolved);
    expect(closed.closureDisposition).toBe("DOCUMENTED_EXCEPTION");
    const reloadedRow = (await new MockDataProvider().getCases()).find(
      (item) => item.caseId === caseFile.caseId
    )!;
    expect(reloadedRow.closureDisposition).toBe("DOCUMENTED_EXCEPTION");
  });

  it("does not close an already-closed case or escalate an escalated one", async () => {
    const provider = new MockDataProvider();
    const rows = await provider.getCases();
    const closed = rows.find((item) => item.status === CaseStatus.Resolved)!;
    const escalated = rows.find((item) => item.status === CaseStatus.Escalated)!;
    const closedCase = await provider.getCase(closed.caseId);
    await expect(
      provider.reviewCase(closed.caseId, {
        decisionType: "CLOSE_AS_RESOLVED",
        reasonCode: "OTHER",
        rationale: RATIONALE,
        evidenceIds: [closedCase.evidence[0].id]
      })
    ).rejects.toThrow(/already closed/);
    await expect(
      provider.reviewCase(escalated.caseId, {
        decisionType: "ESCALATE",
        reasonCode: "NEEDS_HUMAN_REVIEW",
        rationale: RATIONALE,
        evidenceIds: []
      })
    ).rejects.toThrow(/already escalated/);
  });
});

describe("reopening (acceptance check 5)", () => {
  it("clears current resolution fields when a closed case is escalated", async () => {
    const provider = new MockDataProvider();
    const caseFile = await firstOpenCase(provider);
    await provider.reviewCase(caseFile.caseId, {
      decisionType: "CLOSE_AS_RESOLVED",
      reasonCode: "OTHER",
      rationale: RATIONALE,
      evidenceIds: [caseFile.evidence[0].id]
    });
    await provider.reviewCase(caseFile.caseId, {
      decisionType: "ESCALATE",
      reasonCode: "NEEDS_HUMAN_REVIEW",
      rationale: "Reopened: credit memo amount disputed.",
      evidenceIds: []
    });
    const reopened = await provider.getCase(caseFile.caseId);
    expect(reopened.status).toBe(CaseStatus.Escalated);
    expect(reopened.resolvedAt).toBeUndefined();
    expect(reopened.closureDisposition).toBeUndefined();
    const row = (await provider.getCases()).find((item) => item.caseId === caseFile.caseId)!;
    expect(row.resolvedAt).toBeUndefined();

    const fresh = new MockDataProvider();
    const reloaded = await fresh.getCase(caseFile.caseId);
    expect(reloaded.status).toBe(CaseStatus.Escalated);
    expect(reloaded.resolvedAt).toBeUndefined();
  });

  it("keeps imported escalations, closures, and import time across reload", async () => {
    const provider = new MockDataProvider();
    await provider.getCases();
    const { caseIds } = await provider.importNextBatch(1);
    expect(caseIds.length).toBe(12);
    const [toClose, toEscalate, toRequest] = caseIds;
    const closeCase = await provider.getCase(toClose);
    await provider.reviewCase(toClose, {
      decisionType: "CLOSE_AS_RESOLVED",
      reasonCode: "OTHER",
      rationale: RATIONALE,
      evidenceIds: [closeCase.evidence[0].id]
    });
    await provider.reviewCase(toEscalate, {
      decisionType: "ESCALATE",
      reasonCode: "NEEDS_HUMAN_REVIEW",
      rationale: "Needs procurement confirmation.",
      evidenceIds: []
    });
    await provider.reviewCase(toRequest, {
      decisionType: "REQUEST_MORE_EVIDENCE",
      reasonCode: "MISSING_DOCUMENTATION",
      rationale: "Receiving log not attached yet.",
      evidenceIds: []
    });
    const untouched = caseIds[3];
    const importedAt = (await provider.getCases()).find((r) => r.caseId === untouched)!.lastUpdated;

    const fresh = new MockDataProvider();
    expect((await fresh.getCase(toClose)).status).toBe(CaseStatus.Resolved);
    expect((await fresh.getCase(toEscalate)).status).toBe(CaseStatus.Escalated);
    const requested = (await fresh.getCases()).find((r) => r.caseId === toRequest)!;
    expect(requested.status).toBe(CaseStatus.ScreenedUnresolved);
    expect(requested.reviewed).toBe(true);
    const reloadedUntouched = (await fresh.getCases()).find((r) => r.caseId === untouched)!;
    expect(reloadedUntouched.status).toBe(CaseStatus.ScreenedUnresolved);
    expect(reloadedUntouched.lastUpdated).toBe(importedAt);
  });
});

describe("link verification (acceptance check 7)", () => {
  it("rejects unknown IDs and evidence the claim does not cite", async () => {
    const provider = new MockDataProvider();
    const caseFile = await firstOpenCase(provider);
    const claim = caseFile.claims[0];
    const cited = claim.supportedByEvidenceIds[0];
    const uncited = caseFile.evidence.find((e) => !claim.supportedByEvidenceIds.includes(e.id))!;

    expect(await provider.verifyLink({ caseId: "nonexistent", claimId: "fake", evidenceId: "fake" }))
      .toEqual({ ok: false });
    expect(
      await provider.verifyLink({ caseId: caseFile.caseId, claimId: "fake", evidenceId: cited })
    ).toEqual({ ok: false });
    expect(
      await provider.verifyLink({ caseId: caseFile.caseId, claimId: claim.id, evidenceId: uncited.id })
    ).toEqual({ ok: false });
    expect(
      await provider.verifyLink({ caseId: caseFile.caseId, claimId: claim.id, evidenceId: cited })
    ).toEqual({ ok: true });
  });
});

describe("fixture-grounded match evidence", () => {
  it("never reports an unqualified pass while a monetary variance is unexplained", async () => {
    const provider = new MockDataProvider();
    const rows = await provider.getCases();
    for (const row of rows) {
      const caseFile = await provider.getCase(row.caseId);
      expect(caseFile.matchEvidence?.invoiceAmount, row.caseId).toBe(row.sourceRefs?.invoiceAmount);
      const result = evaluateThreeWayMatch(caseFile.matchEvidence);
      if (row.variance !== 0) {
        expect(result.status, row.caseId).not.toBe("pass");
      }
    }
  });

  it("flags negative variances by magnitude", async () => {
    const provider = new MockDataProvider();
    const rows = await provider.getCases();
    const big = rows.find((row) => Math.abs(row.variance) > 800);
    if (!big) {
      return;
    }
    big.variance = -Math.abs(big.variance);
    const caseFile = await provider.getCase(big.caseId);
    expect(caseFile.conflicts.some((c) => c.severity === "high")).toBe(true);
  });
});
