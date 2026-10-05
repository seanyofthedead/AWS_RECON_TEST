import { DataProvider } from "./DataProvider";
import { apiFetch } from "./apiClient";
import { CaseFile } from "../types/case";
import { ReviewerPacket } from "../types/queue";
import { ReviewDecision, ReviewRequest } from "../types/review";
import { TransactionRow } from "../types/transaction";
import { IngestionReport } from "../utils/ingestion";

export class ApiDataProvider implements DataProvider {
  async getCases(): Promise<TransactionRow[]> {
    return apiFetch<TransactionRow[]>("/api/cases");
  }

  async getCase(caseId: string): Promise<CaseFile> {
    return apiFetch<CaseFile>(`/api/cases/${encodeURIComponent(caseId)}`);
  }

  async reviewCase(caseId: string, request: ReviewRequest): Promise<ReviewDecision> {
    return apiFetch<ReviewDecision>(`/api/cases/${encodeURIComponent(caseId)}/review`, {
      method: "POST",
      body: JSON.stringify(request)
    });
  }

  async getEscalations(): Promise<ReviewerPacket[]> {
    return apiFetch<ReviewerPacket[]>("/api/escalations");
  }

  async getEscalation(caseId: string): Promise<ReviewerPacket> {
    return apiFetch<ReviewerPacket>(`/api/escalations/${encodeURIComponent(caseId)}`);
  }

  async verifyLink(request: {
    caseId: string;
    claimId: string;
    evidenceId: string;
  }): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>("/api/verify-link", {
      method: "POST",
      body: JSON.stringify(request)
    });
  }

  // The backend records the reviewer from its own auth; nothing to keep here.
  setActor(_actor: { id: string; name: string } | null): void {}

  // Ingestion reports are produced by the mock CSV loader only.
  getIngestionReport(source = "baseline"): IngestionReport {
    throw new Error(`No ingestion report for ${source}.`);
  }

  listIngestionReports(): Record<string, IngestionReport> {
    return {};
  }

  async importNextBatch(batchId: number): Promise<{ importedCount: number; caseIds: string[] }> {
    return apiFetch<{ importedCount: number; caseIds: string[] }>("/api/batch/import", {
      method: "POST",
      body: JSON.stringify({ batchId })
    });
  }
}

