import Papa from "papaparse";
import { DataProvider } from "./DataProvider";
import {
  CaseFile,
  CaseStatus,
  Claim,
  ConfidenceBand,
  ConflictFlag,
  EvidenceObject,
  RunLogEntry,
  StructuredRow
} from "../types/case";
import { TransactionRow } from "../types/transaction";
import {
  ReviewDecision,
  ReviewRequest,
  ReviewDecisionType,
  ReviewRequestNormalized
} from "../types/review";
import { ReviewerPacket } from "../types/queue";
import { measureDev, measureDevAsync } from "../utils/perf";
import { getRootCauseLabel } from "../utils/rootCause";
import { resolveEvidenceLinks } from "../utils/evidenceResolver";

interface CanonicalVarianceRow {
  transactionid?: string;
  vendor?: string;
  variance_category?: string;
  ai_reason?: string;
  commentary?: string;
  evidence_doc_ids?: string;
  doc_number?: string;
  po_number?: string;
  invoice_id?: string;
  next_steps?: string;
  invoice_po_number?: string;
  receipt_id?: string;
  receipt_number?: string;
  receipt_po_number?: string;
  gl_document_id?: string;
  gl_posting_id?: string;
  gl_invoice_id?: string;
  vendor_id?: string;
  po_amount?: string;
  receipt_amount?: string;
  gl_amount?: string;
}

const REVIEW_STORAGE_KEY = "recon_review_decisions_v1";
const IMPORT_BATCH_STORAGE_KEY = "recon_imported_batches_v1";

const toNumber = (value: string | undefined, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
};

const mulberry32 = (seed: number) => {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const normalizeHeader = (header: string) => {
  const normalized = header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
  if (normalized === "transaction_id" || normalized === "transactionid") {
    return "transactionid";
  }
  if (normalized === "ai_reason" || normalized === "ai_reason_") {
    return "ai_reason";
  }
  if (normalized === "variance_category") {
    return "variance_category";
  }
  if (normalized === "evidence_doc_ids") {
    return "evidence_doc_ids";
  }
  return normalized;
};

const normalizeRecord = (row: Record<string, string>) => {
  return Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
    const normalizedKey = normalizeHeader(key);
    if (normalizedKey) {
      acc[normalizedKey] = value;
    }
    return acc;
  }, {});
};

const normalizeTxId = (rawId: string) => {
  const cleaned = rawId.trim().toUpperCase().replace(/\s+/g, "");
  if (cleaned.startsWith("TRANSACTION-")) {
    return `TX-${cleaned.slice("TRANSACTION-".length)}`;
  }
  if (cleaned.startsWith("TX-")) {
    return cleaned;
  }
  return cleaned;
};

// Deterministic demo mapping: TX-1000001 -> caseIndex 1, TX-1000100 -> caseIndex 100.
const getCaseIndex = (transactionId: string) => {
  const match = transactionId.match(/TX-(\d+)/i);
  if (!match) {
    return null;
  }
  const numericId = Number(match[1]);
  if (!Number.isFinite(numericId)) {
    return null;
  }
  const ordinal = numericId - 1000000;
  return Number.isFinite(ordinal) ? ordinal : null;
};

const getTransactionIdFromRow = (row: Record<string, string>) => {
  return (
    row.transactionId ??
    row.TransactionId ??
    row.TransactionID ??
    row.transaction_id ??
    row.transactionid ??
    null
  );
};

type TransactionMapOptions = {
  minCaseIndex?: number;
  maxCaseIndex?: number;
};

type TransactionOverrides = {
  status?: CaseStatus;
  reviewed?: boolean;
  lastUpdated?: string;
  resolvedAt?: string;
};

const mapTransactionRow = (
  row: Record<string, string>,
  decisions: ReviewDecision[],
  canonicalByTxId: Map<string, CanonicalVarianceRow>,
  options: TransactionMapOptions = {},
  overrides: TransactionOverrides = {}
) => {
  const transactionId = getTransactionIdFromRow(row);
  if (!transactionId) {
    if (import.meta.env.DEV) {
      console.warn("[demo] Missing TransactionID in row; skipping entry.");
    }
    return null;
  }
  const normalizedTxId = normalizeTxId(transactionId);
  const caseIndex = getCaseIndex(normalizedTxId);
  if (options.minCaseIndex && (!caseIndex || caseIndex < options.minCaseIndex)) {
    return null;
  }
  if (options.maxCaseIndex && (!caseIndex || caseIndex > options.maxCaseIndex)) {
    return null;
  }

  const canonicalMatch = canonicalByTxId.get(normalizedTxId);
  const postingDate =
    row.postingDate ?? row.PostingDate ?? row.Postingdate ?? new Date().toISOString();
  const vendor = row.vendor ?? row.Vendor ?? "Unknown Vendor";
  const amount = toNumber(row.amount ?? row.Amount);
  const variance = toNumber(row.variance ?? row.Variance);
  const confidenceScore = toNumber(
    row.confidenceScore ?? row.ConfidenceScore ?? row.Confidence,
    0.72
  );
  const caseId = row.caseId ?? row.CaseId ?? `CASE-${normalizedTxId}`;
  const matchingDecisions = decisions.filter((decision) => decision.caseId === caseId);
  const matchingDecision =
    matchingDecisions.length > 0
      ? matchingDecisions[matchingDecisions.length - 1]
      : undefined;

  let status = overrides.status ?? CaseStatus.ScreenedUnresolved;
  if (!overrides.status) {
    if (matchingDecision) {
      status = matchingDecision.decisionType === "ESCALATE"
        ? CaseStatus.Escalated
        : matchingDecision.decisionType === "REQUEST_MORE_EVIDENCE"
          ? CaseStatus.ScreenedUnresolved
          : matchingDecision.decisionType === "CLOSE_AS_RESOLVED"
            ? CaseStatus.Resolved
            : CaseStatus.Reviewed;
    } else {
      const reviewedFlag = String(row.Reviewed ?? "false").toLowerCase() === "true";
      const escalatedFlag = String(row.Escalate ?? "false").toLowerCase() === "true";
      if (escalatedFlag) {
        status = CaseStatus.Escalated;
      } else if (reviewedFlag) {
        status = CaseStatus.Reviewed;
      }
    }
  }

  const reviewed = overrides.reviewed ?? status !== CaseStatus.ScreenedUnresolved;
  const lastUpdated = overrides.lastUpdated ?? matchingDecision?.timestamp ?? postingDate;
  const resolvedAt =
    overrides.resolvedAt ??
    (matchingDecision?.decisionType === "CLOSE_AS_RESOLVED"
      ? matchingDecision.timestamp
      : undefined);

  const transaction: TransactionRow = {
    transactionId,
    postingDate,
    vendor,
    amount,
    variance,
    confidenceScore,
    caseId,
    status,
    confidenceBand: getConfidenceBand(confidenceScore),
    reviewed,
    lastUpdated,
    canonicalAiReason: canonicalMatch?.ai_reason,
    canonicalVarianceCategory: canonicalMatch?.variance_category,
    resolvedAt
  };
  if (resolvedAt) {
    transaction.status = CaseStatus.Resolved;
    transaction.lastUpdated = resolvedAt;
    transaction.resolvedAt = resolvedAt;
  }
  return transaction;
};

const mapTransactionRows = (
  rows: Record<string, string>[],
  decisions: ReviewDecision[],
  canonicalByTxId: Map<string, CanonicalVarianceRow>,
  options: TransactionMapOptions = {},
  overrides: TransactionOverrides = {}
) => {
  return rows
    .map((row) => mapTransactionRow(row, decisions, canonicalByTxId, options, overrides))
    .filter((row): row is TransactionRow => Boolean(row));
};

const logCaseIndexSummary = (transactions: TransactionRow[], label: string) => {
  if (!import.meta.env.DEV) {
    return;
  }
  const indices = transactions
    .map((row) => getCaseIndex(row.transactionId))
    .filter((value): value is number => Number.isFinite(value));
  if (indices.length === 0) {
    console.debug(`[demo] ${label}: no case indices detected.`);
    return;
  }
  const min = Math.min(...indices);
  const max = Math.max(...indices);
  console.debug(`[demo] ${label}: caseIndex range ${min}-${max} (${indices.length}).`);
};

const seededOffsetDays = (seed: number, range: number) => {
  const rand = mulberry32(seed);
  return Math.floor(rand() * range);
};

const dedupeTransactions = (rows: TransactionRow[]) => {
  const seenCaseIds = new Set<string>();
  const seenTransactionIds = new Set<string>();
  const deduped: TransactionRow[] = [];
  const duplicateCaseIds: string[] = [];
  const duplicateTransactionIds: string[] = [];

  rows.forEach((row) => {
    const normalizedTxId = normalizeTxId(row.transactionId);
    const hasCaseId = seenCaseIds.has(row.caseId);
    const hasTransactionId = normalizedTxId
      ? seenTransactionIds.has(normalizedTxId)
      : false;
    if (hasCaseId || hasTransactionId) {
      if (hasCaseId) {
        duplicateCaseIds.push(row.caseId);
      }
      if (hasTransactionId && normalizedTxId) {
        duplicateTransactionIds.push(normalizedTxId);
      }
      return;
    }
    seenCaseIds.add(row.caseId);
    if (normalizedTxId) {
      seenTransactionIds.add(normalizedTxId);
    }
    deduped.push(row);
  });

  return deduped;
};

const parseCsv = async <T,>(url: string) => {
  const text = await measureDevAsync(`fetch ${url}`, async () => {
    const response = await fetch(url);
    return response.text();
  });
  return measureDev(`parse ${url}`, () => {
    const result = Papa.parse<T>(text, {
      header: true,
      skipEmptyLines: true
    });
    return result.data;
  });
};

const getConfidenceBand = (score: number): ConfidenceBand => {
  if (score >= 0.82) {
    return ConfidenceBand.High;
  }
  if (score >= 0.65) {
    return ConfidenceBand.Medium;
  }
  return ConfidenceBand.Low;
};

const readDecisions = (): ReviewDecision[] => {
  const raw = localStorage.getItem(REVIEW_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as ReviewDecision[];
  } catch {
    return [];
  }
};

const writeDecisions = (decisions: ReviewDecision[]) => {
  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(decisions));
};

const readImportedBatches = (): number[] => {
  const raw = localStorage.getItem(IMPORT_BATCH_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as number[];
    return parsed.filter((value) => Number.isFinite(value));
  } catch {
    return [];
  }
};

const writeImportedBatches = (batchIds: number[]) => {
  localStorage.setItem(IMPORT_BATCH_STORAGE_KEY, JSON.stringify(batchIds));
};

export class MockDataProvider implements DataProvider {
  private static instance: MockDataProvider | null = null;
  private initialized = false;
  private transactions: TransactionRow[] = [];
  private cases = new Map<string, CaseFile>();
  private canonicalByTxId = new Map<string, CanonicalVarianceRow>();
  private importedBatchIds = new Set<number>();

  static getInstance() {
    if (!MockDataProvider.instance) {
      MockDataProvider.instance = new MockDataProvider();
    }
    return MockDataProvider.instance;
  }

  private async initialize() {
    if (this.initialized) {
      return;
    }
    const [transactions, canonicalRaw] = await Promise.all([
      parseCsv<Record<string, string>>("/data/ui_transactions.csv"),
      parseCsv<Record<string, string>>("/data/canonical_variances.csv")
    ]);
    const canonicalNormalized = canonicalRaw.map((row) => {
      const normalized = normalizeRecord(row);
      return {
        transactionid: normalized.transactionid,
        vendor: normalized.vendor,
        variance_category: normalized.variance_category,
        ai_reason: normalized.ai_reason,
        commentary: normalized.commentary,
        evidence_doc_ids: normalized.evidence_doc_ids,
        doc_number: normalized.doc_number,
        po_number: normalized.po_number,
        invoice_id: normalized.invoice_id,
        next_steps: normalized.next_steps,
        invoice_po_number: normalized.invoice_po_number,
        receipt_id: normalized.receipt_id,
        receipt_number: normalized.receipt_number,
        receipt_po_number: normalized.receipt_po_number,
        gl_document_id: normalized.gl_document_id,
        gl_posting_id: normalized.gl_posting_id,
        gl_invoice_id: normalized.gl_invoice_id,
        vendor_id: normalized.vendor_id,
        po_amount: normalized.po_amount,
        receipt_amount: normalized.receipt_amount,
        gl_amount: normalized.gl_amount
      };
    });
    this.canonicalByTxId = new Map();
    canonicalNormalized.forEach((row) => {
      if (!row.transactionid) {
        return;
      }
      const normalizedId = normalizeTxId(row.transactionid);
      if (this.canonicalByTxId.has(normalizedId)) {
        if (import.meta.env.DEV) {
          console.warn(`[canonical] duplicate TransactionID ${normalizedId}`);
        }
        return;
      }
      this.canonicalByTxId.set(normalizedId, row);
    });

    const decisions = readDecisions();
    this.transactions = measureDev("map transactions", () =>
      dedupeTransactions(
        mapTransactionRows(transactions, decisions, this.canonicalByTxId, {
          minCaseIndex: 13,
          maxCaseIndex: 100
        })
      )
    );
    logCaseIndexSummary(this.transactions, "baseline");
    if (import.meta.env.DEV) {
      const indices = this.transactions
        .map((row) => getCaseIndex(row.transactionId))
        .filter((value): value is number => Number.isFinite(value));
      if (indices.length > 0) {
        const min = Math.min(...indices);
        const max = Math.max(...indices);
        console.debug(`[demo] baseline expected 13-100, got ${min}-${max}.`);
      }
    }
    const importedBatchIds = readImportedBatches();
    this.importedBatchIds = new Set(importedBatchIds);
    if (importedBatchIds.includes(1)) {
      const batchRows = await parseCsv<Record<string, string>>(
        "/data/ui_transactions_batch_1.csv"
      );
      const existingCaseIds = new Set(this.transactions.map((item) => item.caseId));
      const importTimestamp = new Date().toISOString();
      const batchTransactions = dedupeTransactions(
        mapTransactionRows(
          batchRows,
          decisions,
          this.canonicalByTxId,
          { minCaseIndex: 1, maxCaseIndex: 12 },
          {
            status: CaseStatus.ScreenedUnresolved,
            reviewed: false,
            lastUpdated: importTimestamp
          }
        )
      );
      batchTransactions.forEach((transaction) => {
        if (!existingCaseIds.has(transaction.caseId)) {
          this.transactions.push(transaction);
          existingCaseIds.add(transaction.caseId);
        }
      });
      this.transactions = dedupeTransactions(this.transactions);
      logCaseIndexSummary(batchTransactions, "rehydrated import");
    }
    if (import.meta.env.DEV) {
      const sampleIds = ["TX-1000004", "TX-1000003", "TX-1000013", "TX-1000002"];
      const sample = sampleIds
        .map((id) => this.transactions.find((item) => item.transactionId === id))
        .filter(Boolean)
        .map((item) => ({
          transactionId: item?.transactionId,
          canonicalAiReason: item?.canonicalAiReason,
          canonicalVarianceCategory: item?.canonicalVarianceCategory,
          finalBucket: item ? getRootCauseLabel(item) : undefined
        }));
      if (sample.length > 0) {
        console.table(sample);
      }
    }
    this.initialized = true;
  }

  private async getCaseFromTransaction(transaction: TransactionRow): Promise<CaseFile> {
    const existing = this.cases.get(transaction.caseId);
    if (existing) {
      return existing;
    }
    const seed = hashString(transaction.caseId);
    const rand = mulberry32(seed);
    const normalizedTxId = normalizeTxId(transaction.transactionId);
    const canonicalMatch = this.canonicalByTxId.get(normalizedTxId);
    const postingDate = new Date(transaction.postingDate);
    const stableDate = Number.isNaN(postingDate.getTime())
      ? new Date(2025, 0, 1)
      : postingDate;
    const createdAtBase = stableDate.getTime();
    const createdAtOffsets = [
      seededOffsetDays(seed + 1, 7),
      seededOffsetDays(seed + 2, 6),
      seededOffsetDays(seed + 3, 5),
      seededOffsetDays(seed + 4, 4)
    ];
    const createdAtValues = createdAtOffsets.map((offset) => {
      const date = new Date(createdAtBase - offset * 24 * 60 * 60 * 1000);
      return date.toISOString();
    });
    const evidenceIds = [
      `${transaction.caseId}-evidence-invoice`,
      `${transaction.caseId}-evidence-po`,
      `${transaction.caseId}-evidence-receipt`,
      `${transaction.caseId}-evidence-gl`
    ];
    const caseIndex = getCaseIndex(transaction.transactionId);
    // Legacy evidence paths and evidence_index.json are deprecated.
    // Evidence links are now derived deterministically by case index.
    const evidenceLinks = caseIndex ? resolveEvidenceLinks(caseIndex) : {};
    const invoiceUrl = evidenceLinks.invoice;
    const poUrl = evidenceLinks.po;
    const receiptUrl = evidenceLinks.receipt;
    const glUrl = evidenceLinks.gl;
    if (import.meta.env.DEV && caseIndex && caseIndex <= 100) {
      if (!invoiceUrl || !poUrl || !receiptUrl || !glUrl) {
        console.warn(
          `[evidence] Missing expected PDF links for CASE-${String(caseIndex).padStart(5, "0")}`
        );
      }
    }
    // NOTE: Policy / Contract PDFs are supplemental context.
    // They are intentionally excluded from three-way match evidence.
    const evidence: EvidenceObject[] = [
      {
        id: evidenceIds[0],
        kind: "document",
        title: "Invoice",
        description: "Supplier invoice document.",
        snippet: canonicalMatch?.invoice_id
          ? `Invoice ID ${canonicalMatch.invoice_id}`
          : "Invoice ID on file.",
        source: "AP Extract",
        weight: Number((0.5 + rand() * 0.4).toFixed(2)),
        createdAt: createdAtValues[0],
        url: invoiceUrl
      },
      {
        id: evidenceIds[1],
        kind: "document",
        title: "Purchase Order",
        description: "Purchase order document.",
        snippet: canonicalMatch?.po_number
          ? `PO ${canonicalMatch.po_number}`
          : "Purchase order on file.",
        source: "Procurement",
        weight: Number((0.55 + rand() * 0.35).toFixed(2)),
        createdAt: createdAtValues[1],
        url: poUrl
      },
      {
        id: evidenceIds[2],
        kind: "document",
        title: "Receipt",
        description: "Goods receipt document.",
        snippet: canonicalMatch?.receipt_id
          ? `Receipt ${canonicalMatch.receipt_id}`
          : "Receipt record on file.",
        source: "Receiving",
        weight: Number((0.5 + rand() * 0.4).toFixed(2)),
        createdAt: createdAtValues[2],
        url: receiptUrl
      },
      {
        id: evidenceIds[3],
        kind: "document",
        title: "GL Posting",
        description: "General ledger posting extract.",
        snippet: canonicalMatch?.gl_document_id
          ? `GL ${canonicalMatch.gl_document_id}`
          : "GL posting on file.",
        source: "GL Extract",
        weight: Number((0.5 + rand() * 0.4).toFixed(2)),
        createdAt: createdAtValues[3],
        url: glUrl
      }
    ];
    const claims: Claim[] = [
      {
        id: `${transaction.caseId}-claim-1`,
        statement: `Invoice and PO documents are linked for ${transaction.vendor}.`,
        source: "Reconciliation Model",
        confidence: Number((0.7 + rand() * 0.25).toFixed(2)),
        supportedByEvidenceIds: [evidenceIds[0], evidenceIds[1]]
      },
      {
        id: `${transaction.caseId}-claim-2`,
        statement: "Receipt and GL posting documentation are available for review.",
        source: "Variance Analyzer",
        confidence: Number((0.6 + rand() * 0.3).toFixed(2)),
        supportedByEvidenceIds: [evidenceIds[2], evidenceIds[3]]
      },
      {
        id: `${transaction.caseId}-claim-3`,
        statement: "Invoice, PO, receipt, and GL artifacts are assembled.",
        source: "Counterparty Monitor",
        confidence: Number((0.65 + rand() * 0.25).toFixed(2)),
        supportedByEvidenceIds: evidenceIds
      }
    ];
    const conflicts: ConflictFlag[] = [];
    if (transaction.variance > 500 || rand() > 0.7) {
      conflicts.push({
        id: `${transaction.caseId}-conflict-1`,
        description: "Variance exceeds typical category mean.",
        severity: transaction.variance > 800 ? "high" : "medium",
        checklist: [
          "Re-check invoice line items",
          "Validate vendor contract clause",
          "Confirm approval chain"
        ]
      });
    }
    if (rand() > 0.85) {
      conflicts.push({
        id: `${transaction.caseId}-conflict-2`,
        description: "Missing supporting attachment for invoice.",
        severity: "low",
        checklist: ["Request missing attachment", "Confirm invoice metadata"]
      });
    }
    const postingExpected = "Within policy window";
    const postingActual =
      rand() > 0.7 ? "Outside policy window" : "Within policy window";
    const structuredRows: StructuredRow[] = [
      {
        id: `${transaction.caseId}-structured-1`,
        field: "Vendor match",
        expected: transaction.vendor,
        actual: transaction.vendor,
        status: "match"
      },
      {
        id: `${transaction.caseId}-structured-2`,
        field: "Amount match",
        expected: `$${transaction.amount.toFixed(2)}`,
        actual: `$${(transaction.amount + transaction.variance).toFixed(2)}`,
        status: transaction.variance > 300 ? "mismatch" : "warning"
      },
      {
        id: `${transaction.caseId}-structured-3`,
        field: "Posting window",
        expected: postingExpected,
        actual: postingActual,
        status: postingActual === postingExpected ? "match" : "mismatch"
      }
    ];
    const runLog: RunLogEntry[] = [
      {
        id: `${transaction.caseId}-log-1`,
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        message: "Model evaluated vendor risk score."
      },
      {
        id: `${transaction.caseId}-log-2`,
        timestamp: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
        message: "Variance trend compared to canonical benchmarks."
      },
      {
        id: `${transaction.caseId}-log-3`,
        timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        message: "Evidence pack assembled for review."
      }
    ];
    const caseFile: CaseFile = {
      caseId: transaction.caseId,
      transactionId: transaction.transactionId,
      status: transaction.status,
      confidenceBand: transaction.confidenceBand,
      claims,
      evidence,
      conflicts,
      runLog,
      structuredRows,
      matchEvidence: canonicalMatch
        ? {
            transactionId: normalizedTxId,
            invoiceId: canonicalMatch.invoice_id,
            poNumber: canonicalMatch.po_number,
            invoicePoNumber: canonicalMatch.invoice_po_number,
            receiptId: canonicalMatch.receipt_id,
            receiptNumber: canonicalMatch.receipt_number,
            receiptPoNumber: canonicalMatch.receipt_po_number,
            glDocumentId: canonicalMatch.gl_document_id,
            glPostingId: canonicalMatch.gl_posting_id,
            glInvoiceId: canonicalMatch.gl_invoice_id,
            vendorId: canonicalMatch.vendor_id,
            poAmount: canonicalMatch.po_amount,
            receiptAmount: canonicalMatch.receipt_amount,
            glAmount: canonicalMatch.gl_amount
          }
        : undefined,
      resolvedAt: transaction.status === CaseStatus.Resolved ? transaction.lastUpdated : undefined
    };
    this.cases.set(transaction.caseId, caseFile);
    return caseFile;
  }

  async getCases() {
    await this.initialize();
    return this.transactions;
  }

  async getCase(caseId: string) {
    await this.initialize();
    const transaction = this.transactions.find((item) => item.caseId === caseId);
    if (!transaction) {
      throw new Error("Case not found.");
    }
    return this.getCaseFromTransaction(transaction);
  }

  async reviewCase(caseId: string, request: ReviewRequest) {
    await this.initialize();
    const transactionIndex = this.transactions.findIndex((item) => item.caseId === caseId);
    if (transactionIndex === -1) {
      throw new Error("Case not found.");
    }
    const normalizedRequest = this.normalizeReviewRequest(request);
    const resolvedTimestamp = new Date().toISOString();
    const decision: ReviewDecision = {
      caseId,
      ...normalizedRequest,
      reviewer: "UI Analyst",
      timestamp: resolvedTimestamp
    };
    const decisions = readDecisions();
    decisions.push(decision);
    writeDecisions(decisions);

    const status = this.getStatusForDecision(normalizedRequest.decisionType);
    this.transactions[transactionIndex] = {
      ...this.transactions[transactionIndex],
      status,
      reviewed: true,
      lastUpdated: decision.timestamp
    };
    const caseFile = await this.getCaseFromTransaction(this.transactions[transactionIndex]);
    caseFile.status = status;
    if (status === CaseStatus.Resolved) {
      caseFile.resolvedAt = decision.timestamp;
      this.transactions[transactionIndex].status = CaseStatus.Resolved;
      this.transactions[transactionIndex].lastUpdated = decision.timestamp;
      this.transactions[transactionIndex].resolvedAt = decision.timestamp;
    }
    this.cases.set(caseId, caseFile);
    return decision;
  }

  async getEscalations() {
    await this.initialize();
    return this.transactions
      .filter((item) => item.status === CaseStatus.Escalated)
      .map((item) => this.buildReviewerPacket(item.caseId));
  }

  async getEscalation(caseId: string) {
    await this.initialize();
    return this.buildReviewerPacket(caseId);
  }

  async verifyLink(request: { caseId: string; claimId: string; evidenceId: string }) {
    await this.initialize();
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { ok: Boolean(request.caseId && request.claimId && request.evidenceId) };
  }

  async importNextBatch(batchId: number) {
    await this.initialize();
    const normalizedBatchId = Math.max(0, Math.floor(batchId));
    if (normalizedBatchId !== 1) {
      return { importedCount: 0, caseIds: [] };
    }

    if (this.importedBatchIds.has(normalizedBatchId)) {
      return { importedCount: 0, caseIds: [] };
    }

    const decisions = readDecisions();
    const batchRows = await parseCsv<Record<string, string>>(
      "/data/ui_transactions_batch_1.csv"
    );
    const importTimestamp = new Date().toISOString();
    const batchTransactions = dedupeTransactions(
      mapTransactionRows(
        batchRows,
        decisions,
        this.canonicalByTxId,
        { minCaseIndex: 1, maxCaseIndex: 12 },
        {
          status: CaseStatus.ScreenedUnresolved,
          reviewed: false,
          lastUpdated: importTimestamp
        }
      )
    );

    const existingCaseIds = new Set(this.transactions.map((item) => item.caseId));
    const newTransactions = batchTransactions.filter(
      (transaction) => !existingCaseIds.has(transaction.caseId)
    );
    if (newTransactions.length > 0) {
      this.transactions.push(...newTransactions);
      this.transactions = dedupeTransactions(this.transactions);
    }
    this.importedBatchIds.add(normalizedBatchId);
    writeImportedBatches(Array.from(this.importedBatchIds));
    if (import.meta.env.DEV) {
      logCaseIndexSummary(newTransactions, "imported batch");
      logCaseIndexSummary(this.transactions, "after import");
      if (newTransactions.length === 0) {
        console.debug("[demo] importNextBatch: batch already imported.");
      } else {
        if (newTransactions.length !== 12) {
          console.warn(
            `[demo] importNextBatch expected 12 cases, got ${newTransactions.length}.`
          );
        }
        const indices = newTransactions
          .map((row) => getCaseIndex(row.transactionId))
          .filter((value): value is number => Number.isFinite(value));
        if (indices.length > 0) {
          const min = Math.min(...indices);
          const max = Math.max(...indices);
          console.debug(`[demo] imported expected 1-12, got ${min}-${max}.`);
        }
      }
    }
    return { importedCount: newTransactions.length, caseIds: newTransactions.map((t) => t.caseId) };
  }

  private getStatusForDecision(decisionType: ReviewDecisionType) {
    if (decisionType === "ESCALATE") {
      return CaseStatus.Escalated;
    }
    if (decisionType === "REQUEST_MORE_EVIDENCE") {
      return CaseStatus.ScreenedUnresolved;
    }
    if (decisionType === "CLOSE_AS_RESOLVED") {
      return CaseStatus.Resolved;
    }
    return CaseStatus.Reviewed;
  }

  private normalizeReviewRequest(request: ReviewRequest): ReviewRequestNormalized {
    if ("decisionType" in request) {
      return request;
    }
    const decisionType =
      request.decision === "ACCEPT"
        ? "CLOSE_AS_RESOLVED"
        : request.decision === "ESCALATE"
          ? "ESCALATE"
          : request.decision === "REQUEST_MORE_EVIDENCE"
            ? "REQUEST_MORE_EVIDENCE"
            : "OVERRIDE";
    return {
      decisionType,
      reasonCode: request.reasonCode ?? "OTHER",
      rationale: request.rationaleText,
      evidenceIds: request.evidenceIds ?? []
    };
  }

  private buildReviewerPacket(caseId: string): ReviewerPacket {
    const transaction = this.transactions.find((item) => item.caseId === caseId);
    if (!transaction) {
      throw new Error("Escalation not found.");
    }
    const seed = hashString(`${caseId}-packet`);
    const rand = mulberry32(seed);
    const priority = rand() > 0.75 ? "high" : rand() > 0.4 ? "medium" : "low";
    const createdAt = new Date(Date.now() - rand() * 1000 * 60 * 60 * 24 * 2).toISOString();
    return {
      caseId,
      summary: `Variance of ${transaction.variance.toFixed(
        2
      )} flagged for ${transaction.vendor}.`,
      reasonSummary: rand() > 0.6 ? "Variance exceeds policy threshold." : "Attachment missing.",
      priority,
      requestedBy: "Reconciliation Agent",
      submittedAt: new Date(Date.now() - rand() * 1000 * 60 * 60 * 6).toISOString(),
      createdAt,
      attemptedSteps: [
        "Checked vendor policy thresholds",
        "Matched invoice against PO",
        "Reviewed historical variance"
      ],
      evidenceFound: [
        "Invoice metadata validated",
        "Vendor contract addendum available"
      ],
      missingChecklist: ["Approval chain confirmation", "Updated receipt attachment"],
      suggestedNextActions: [
        "Request supporting documentation",
        "Validate posting window with AP",
        "Escalate to finance lead if unresolved"
      ]
    };
  }
}
