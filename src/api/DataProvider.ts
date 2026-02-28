import { CaseFile } from "../types/case";
import { TransactionRow } from "../types/transaction";
import { ReviewDecision, ReviewRequest } from "../types/review";
import { ReviewerPacket } from "../types/queue";

export interface DataProvider {
  getCases(): Promise<TransactionRow[]>;
  getCase(caseId: string): Promise<CaseFile>;
  reviewCase(caseId: string, request: ReviewRequest): Promise<ReviewDecision>;
  getEscalations(): Promise<ReviewerPacket[]>;
  getEscalation(caseId: string): Promise<ReviewerPacket>;
  verifyLink(request: {
    caseId: string;
    claimId: string;
    evidenceId: string;
  }): Promise<{ ok: boolean }>;
  importNextBatch(
    batchId: number
  ): Promise<{ importedCount: number; caseIds: string[] }>;
}
