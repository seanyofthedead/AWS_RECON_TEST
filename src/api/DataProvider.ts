import { CaseFile } from "../types/case";
import { TransactionRow } from "../types/transaction";
import { ReviewDecision, ReviewRequest } from "../types/review";
import { ReviewerPacket } from "../types/queue";
import { IngestionReport } from "../utils/ingestion";

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
  // Signed-in user recorded on decisions (null when signed out).
  setActor(actor: { id: string; name: string } | null): void;
  // Row-level load report ("baseline", or "batch-1" once imported).
  getIngestionReport(source?: string): IngestionReport;
  listIngestionReports(): Record<string, IngestionReport>;
  importNextBatch(
    batchId: number
  ): Promise<{ importedCount: number; caseIds: string[] }>;
}
