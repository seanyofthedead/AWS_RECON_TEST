import Papa from "papaparse";
import { DataProvider } from "./DataProvider";
import {
  CaseFile,
  CaseStatus,
  Claim,
  ConfidenceBand,
  ConflictFlag,
  EvidenceObject,
  MatchEvidence,
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
import {
  caseIdForIndex,
  caseIndexFromCaseId,
  realisticTxId,
  vendorDisplayName
} from "../utils/demoIdentities";
import { formatCurrency } from "../utils/formatCurrency";
import { evaluateDecision } from "../utils/closurePolicy";
import { IngestionReport, validateTransactionRows } from "../utils/ingestion";

interface CanonicalVarianceRow {
  transactionid?: string;
  vendor?: string;
  variance_category?: string;
  ai_reason?: string;
  commentary?: string;
  evidence_doc_ids?: string;
  doc_number?: string;
  // Realistic display IDs (PO_Number / Invoice_ID columns).
  po_number?: string;
  invoice_id?: string;
  // Join IDs (lowercase po_number / invoice_id columns) shared with the
  // receipt, GL, and invoice rows. Comparisons use these.
  join_po_number?: string;
  join_invoice_id?: string;
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

const statusForDecision = (decisionType: ReviewDecisionType) => {
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
  const rawVendor = row.vendor ?? row.Vendor ?? "Unknown Vendor";
  const vendor = vendorDisplayName(rawVendor);
  const amount = toNumber(row.amount ?? row.Amount);
  const variance = toNumber(row.variance ?? row.Variance);
  const confidenceScore = toNumber(
    row.confidenceScore ?? row.ConfidenceScore ?? row.Confidence,
    0.72
  );
  const caseIdOverride = row.caseId ?? row.CaseId;
  const caseId =
    caseIdOverride && caseIdOverride.startsWith("CASE-") && !caseIdOverride.includes("TX-")
      ? caseIdOverride
      : caseIndex != null
        ? caseIdForIndex(caseIndex)
        : `CASE-${normalizedTxId}`;
  const displayTransactionId =
    caseIndex != null ? realisticTxId(caseIndex) : transactionId;
  const matchingDecisions = decisions.filter((decision) => decision.caseId === caseId);
  const matchingDecision =
    matchingDecisions.length > 0
      ? matchingDecisions[matchingDecisions.length - 1]
      : undefined;

  // Saved decisions always win. Import overrides only set the starting state
  // of rows nobody has acted on yet.
  let status = CaseStatus.ScreenedUnresolved;
  if (matchingDecision) {
    status = statusForDecision(matchingDecision.decisionType);
  } else if (overrides.status) {
    status = overrides.status;
  } else {
    const reviewedFlag = String(row.Reviewed ?? "false").toLowerCase() === "true";
    const escalatedFlag = String(row.Escalate ?? "false").toLowerCase() === "true";
    if (escalatedFlag) {
      status = CaseStatus.Escalated;
    } else if (reviewedFlag) {
      // Deterministically promote a subset of Reviewed rows to Resolved so
      // the Resolved page is populated on a fresh load. The hash is stable
      // across reloads, so the same cases land in Resolved every time.
      const promoteToResolved = hashString(`${caseId}-resolved`) % 100 < 37;
      status = promoteToResolved ? CaseStatus.Resolved : CaseStatus.Reviewed;
    }
  }

  const reviewed = matchingDecision
    ? true
    : overrides.reviewed ?? status !== CaseStatus.ScreenedUnresolved;
  const lastUpdated = matchingDecision?.timestamp ?? overrides.lastUpdated ?? postingDate;
  let resolvedAt = matchingDecision
    ? matchingDecision.decisionType === "CLOSE_AS_RESOLVED"
      ? matchingDecision.timestamp
      : undefined
    : overrides.resolvedAt;
  if (!resolvedAt && status === CaseStatus.Resolved) {
    const postingMs = Date.parse(postingDate);
    if (Number.isFinite(postingMs)) {
      const offset = 1 + (hashString(`${caseId}-resolved-offset`) % 5);
      const resolvedDate = addBusinessDays(new Date(postingMs), offset);
      resolvedDate.setUTCHours(
        10 + (hashString(`${caseId}-resolved-hour`) % 7),
        0,
        0,
        0
      );
      resolvedAt = resolvedDate.toISOString();
    }
  }

  const transaction: TransactionRow = {
    transactionId: displayTransactionId,
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
    resolvedAt,
    closureDisposition:
      matchingDecision?.decisionType === "CLOSE_AS_RESOLVED"
        ? matchingDecision.disposition
        : undefined,
    closedByAnalyst: matchingDecision?.decisionType === "CLOSE_AS_RESOLVED",
    sourceRefs: {
      invoiceId: row.invoice_id || undefined,
      poNumber: row.po_number || undefined,
      vendorId: row.vendor_id || undefined,
      invoiceAmount: row.invoice_amount || undefined
    }
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
    .map((row) => caseIndexFromCaseId(row.caseId))
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

const addBusinessDays = (date: Date, days: number): Date => {
  const result = new Date(date.getTime());
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return result;
};

const REASON_SUMMARY_BY_ROOT_CAUSE: Record<string, string> = {
  "Timing Difference": "Posting straddles period close; needs accrual confirmation.",
  "Accrual Reversal": "Prior accrual reversal missing; period balance off.",
  "Missing Receipt": "Receipt not posted in receiving system.",
  "Manual Entry Error": "Keyed amount disagrees with source document.",
  "Stale Master Data": "Vendor master record appears out of date.",
  "Reference Data Misalignment": "Mapping codes inconsistent across systems.",
  "Wrong PO Reference": "Invoice PO does not match recorded PO.",
  "Batch Interface Failure": "Inbound batch interface did not post to GL.",
  "Duplicate Transaction": "Same invoice posted more than once.",
  "Unit of Measure Mismatch": "Quantity unit differs between PO and invoice.",
  "Partial Posting": "Posting only partially landed in GL.",
  "Wrong Vendor Mapping": "Posted against the wrong vendor master record.",
  "Price Variance": "Invoice price differs from PO / contract price.",
  "Conversion Error": "Conversion factor applied incorrectly.",
  Other: "Variance exceeds policy threshold; needs analyst review.",
  "Unknown / Needs Review": "Insufficient evidence for automated resolution."
};

const reasonSummaryFor = (label: string): string =>
  REASON_SUMMARY_BY_ROOT_CAUSE[label] ?? "Variance exceeds policy threshold.";

type PoolTemplate = string | ((ctx: { vendor: string; invoiceId: string; poNumber: string }) => string);

const ATTEMPTED_STEPS_POOL: PoolTemplate[] = [
  ({ vendor }) => `Checked ${vendor} master data and policy thresholds`,
  ({ invoiceId }) => `Matched invoice ${invoiceId} against PO on file`,
  "Reviewed historical variance for the past four quarters",
  ({ vendor }) => `Pulled ${vendor} contract addendum from vault`,
  "Compared canonical and ERP postings line by line",
  "Re-ran three-way match with realistic IDs",
  ({ poNumber }) => `Replayed PO ${poNumber} receiving flow`,
  "Reviewed prior-period accrual reversal log",
  "Checked vendor remittance history for duplicate payments"
];

const EVIDENCE_FOUND_POOL: PoolTemplate[] = [
  ({ invoiceId }) => `Invoice ${invoiceId} metadata validated`,
  ({ vendor }) => `${vendor} contract addendum on file`,
  ({ poNumber }) => `PO ${poNumber} approval chain captured`,
  "Receiving log entry located",
  "Prior-period accrual journal entry identified",
  "Vendor remittance email confirmed",
  "GL posting extract attached to packet",
  "Three-way match notes appended"
];

const MISSING_CHECKLIST_POOL: PoolTemplate[] = [
  "Approval chain confirmation from approver of record",
  "Updated receipt attachment from receiving",
  ({ vendor }) => `Latest ${vendor} master data refresh`,
  ({ poNumber }) => `Signed PO ${poNumber} change order`,
  "Vendor credit memo for the price gap",
  "Reference data alignment confirmation",
  "Batch interface re-run confirmation",
  "Period-close sign-off from finance lead"
];

const SUGGESTED_ACTIONS_POOL: PoolTemplate[] = [
  ({ vendor }) => `Request supporting documentation from ${vendor}`,
  "Validate posting window with AP team",
  "Escalate to finance lead if unresolved within 24h",
  ({ invoiceId }) => `Re-run three-way match on invoice ${invoiceId}`,
  ({ poNumber }) => `Confirm PO ${poNumber} with procurement`,
  "Open ticket with master data team for vendor refresh",
  "Coordinate with receiving to post the missing receipt",
  "Reverse and re-post against the correct vendor master"
];

const pickFromPool = (
  pool: PoolTemplate[],
  seed: number,
  count: number,
  ctx: { vendor: string; invoiceId: string; poNumber: string }
): string[] => {
  const indices = Array.from({ length: pool.length }, (_, i) => i);
  const rand = mulberry32(seed);
  // Fisher–Yates shuffle keyed on seed.
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const selected = indices.slice(0, Math.min(count, pool.length)).map((i) => pool[i]);
  return selected.map((item) => (typeof item === "function" ? item(ctx) : item));
};

// Built only from source rows. The diagnosis (AI reason) is never used to
// create or alter evidence, so the match result can disagree with it.
const buildMatchEvidence = (
  transaction: TransactionRow,
  canonical: CanonicalVarianceRow
): MatchEvidence => {
  return {
    transactionId: normalizeTxId(transaction.transactionId),
    invoiceId: canonical.join_invoice_id || undefined,
    poNumber: canonical.join_po_number || undefined,
    // The invoice row's own PO reference, from the invoice source file.
    invoicePoNumber: transaction.sourceRefs?.poNumber,
    receiptId: canonical.receipt_id || undefined,
    receiptNumber: canonical.receipt_number || undefined,
    receiptPoNumber: canonical.receipt_po_number || undefined,
    glDocumentId: canonical.gl_document_id || undefined,
    glPostingId: canonical.gl_posting_id || undefined,
    glInvoiceId: canonical.gl_invoice_id || undefined,
    vendorId: canonical.vendor_id,
    displayInvoiceId: canonical.invoice_id || undefined,
    displayPoNumber: canonical.po_number || undefined,
    // The billed amount from the invoice source row.
    invoiceAmount: transaction.sourceRefs?.invoiceAmount,
    poAmount: canonical.po_amount,
    receiptAmount: canonical.receipt_amount,
    glAmount: canonical.gl_amount,
    monetaryVariance: String(transaction.variance)
  };
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

// A failed fetch is an error, not an empty file; parser errors are returned
// so the ingestion report can show them.
const parseCsvWithErrors = async <T,>(url: string) => {
  const text = await measureDevAsync(`fetch ${url}`, async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
    }
    return response.text();
  });
  return measureDev(`parse ${url}`, () => {
    const result = Papa.parse<T>(text, {
      header: true,
      skipEmptyLines: true
    });
    const errors = result.errors.map(
      (error) => `${url} row ${error.row ?? "?"}: ${error.message}`
    );
    return { data: result.data, errors };
  });
};

const parseCsv = async <T,>(url: string) => (await parseCsvWithErrors<T>(url)).data;

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

type ImportedBatch = { batchId: number; importedAt?: string };

// Older saves stored bare batch numbers without an import time.
const readImportedBatches = (): ImportedBatch[] => {
  const raw = localStorage.getItem(IMPORT_BATCH_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Array<number | ImportedBatch>;
    return parsed
      .map((entry) => (typeof entry === "number" ? { batchId: entry } : entry))
      .filter((entry) => Number.isFinite(entry?.batchId));
  } catch {
    return [];
  }
};

const writeImportedBatches = (batches: ImportedBatch[]) => {
  localStorage.setItem(IMPORT_BATCH_STORAGE_KEY, JSON.stringify(batches));
};

export class MockDataProvider implements DataProvider {
  private static instance: MockDataProvider | null = null;
  private initialized = false;
  private transactions: TransactionRow[] = [];
  private cases = new Map<string, CaseFile>();
  private canonicalByTxId = new Map<string, CanonicalVarianceRow>();
  private importedBatches = new Map<number, ImportedBatch>();
  private ingestionReports = new Map<string, IngestionReport>();

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
    const [transactionFile, canonicalRaw] = await Promise.all([
      parseCsvWithErrors<Record<string, string>>("/data/ui_transactions.csv"),
      parseCsv<Record<string, string>>("/data/canonical_variances.csv")
    ]);
    const baselineReport = validateTransactionRows(transactionFile.data, {
      minCaseIndex: 13,
      maxCaseIndex: 100,
      parseErrors: transactionFile.errors
    });
    this.ingestionReports.set("baseline", baselineReport);
    const transactions = baselineReport.accepted;
    const canonicalNormalized = canonicalRaw.map((row) => {
      const normalized = normalizeRecord(row);
      const raw = row as Record<string, string>;
      // Prefer the realistic capital-case canonical columns (Doc_Number,
      // PO_Number, Invoice_ID) over the placeholder lowercase variants
      // (po_number, invoice_id) that share the same normalized key.
      return {
        transactionid: normalized.transactionid,
        vendor: normalized.vendor,
        variance_category: normalized.variance_category,
        ai_reason: normalized.ai_reason,
        commentary: normalized.commentary,
        evidence_doc_ids: normalized.evidence_doc_ids,
        doc_number: raw.Doc_Number ?? normalized.doc_number,
        po_number: raw.PO_Number ?? normalized.po_number,
        invoice_id: raw.Invoice_ID ?? normalized.invoice_id,
        join_po_number: raw.po_number,
        join_invoice_id: raw.invoice_id,
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
        .map((row) => caseIndexFromCaseId(row.caseId))
        .filter((value): value is number => Number.isFinite(value));
      if (indices.length > 0) {
        const min = Math.min(...indices);
        const max = Math.max(...indices);
        console.debug(`[demo] baseline expected 13-100, got ${min}-${max}.`);
      }
    }
    this.importedBatches = new Map(
      readImportedBatches().map((entry) => [entry.batchId, entry])
    );
    const batchOne = this.importedBatches.get(1);
    if (batchOne) {
      const batchRows = await this.loadBatchRows();
      const existingCaseIds = new Set(this.transactions.map((item) => item.caseId));
      const importTimestamp = batchOne.importedAt;
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
      const sampleCaseIds = ["CASE-00004", "CASE-00003", "CASE-00013", "CASE-00002"];
      const sample = sampleCaseIds
        .map((id) => this.transactions.find((item) => item.caseId === id))
        .filter(Boolean)
        .map((item) => ({
          caseId: item?.caseId,
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
    const caseIndex = caseIndexFromCaseId(transaction.caseId);
    const canonicalLookupKey =
      caseIndex != null ? `TX-${1000000 + caseIndex}` : normalizeTxId(transaction.transactionId);
    const canonicalMatch = this.canonicalByTxId.get(canonicalLookupKey);
    const matchEvidence = canonicalMatch
      ? buildMatchEvidence(transaction, canonicalMatch)
      : undefined;
    const postingDate = new Date(transaction.postingDate);
    const stableDate = Number.isNaN(postingDate.getTime())
      ? new Date(2025, 0, 1)
      : postingDate;
    const createdAtBase = stableDate.getTime();
    const hourSeed = mulberry32(seed + 7);
    // Spread evidence creation across the work day so four artifacts don't all
    // land at midnight UTC. Each offset combines a "days before posting" value
    // with a deterministic time-of-day stamp.
    const evidenceTimeOffsets: Array<{ days: number; hour: number; minute: number }> = [
      { days: seededOffsetDays(seed + 1, 7), hour: 9, minute: Math.floor(hourSeed() * 60) },
      { days: seededOffsetDays(seed + 2, 6), hour: 11, minute: Math.floor(hourSeed() * 60) },
      { days: seededOffsetDays(seed + 3, 5), hour: 14, minute: Math.floor(hourSeed() * 60) },
      { days: seededOffsetDays(seed + 4, 4), hour: 16, minute: Math.floor(hourSeed() * 60) }
    ];
    const createdAtValues = evidenceTimeOffsets.map((offset) => {
      const date = new Date(createdAtBase - offset.days * 24 * 60 * 60 * 1000);
      date.setUTCHours(offset.hour, offset.minute, 0, 0);
      return date.toISOString();
    });
    const evidenceIds = [
      `${transaction.caseId}-evidence-invoice`,
      `${transaction.caseId}-evidence-po`,
      `${transaction.caseId}-evidence-receipt`,
      `${transaction.caseId}-evidence-gl`
    ];
    // Legacy evidence paths and evidence_index.json are deprecated.
    // Evidence links are now derived deterministically by case index.
    const evidenceLinks = caseIndex != null ? resolveEvidenceLinks(caseIndex) : {};
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
        snippet: matchEvidence?.displayInvoiceId
          ? `Invoice ID ${matchEvidence.displayInvoiceId}`
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
        snippet: matchEvidence?.displayPoNumber
          ? `PO ${matchEvidence.displayPoNumber}`
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
        snippet: matchEvidence?.receiptId
          ? `Receipt ${matchEvidence.receiptId}`
          : "No receipt record on file.",
        source: "Receiving",
        weight: Number((0.5 + rand() * 0.4).toFixed(2)),
        createdAt: createdAtValues[2],
        // Don't link a receipt document the source data says does not exist.
        url: matchEvidence?.receiptId || matchEvidence?.receiptNumber ? receiptUrl : undefined
      },
      {
        id: evidenceIds[3],
        kind: "document",
        title: "GL Posting",
        description: "General ledger posting extract.",
        snippet: matchEvidence?.glDocumentId
          ? `GL ${matchEvidence.glDocumentId}`
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
        statement:
          matchEvidence?.receiptId && matchEvidence?.glDocumentId
            ? "Receipt and GL posting records are present in source data."
            : "Receipt or GL posting record is missing from source data.",
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
    // Materiality uses magnitude so understatements are flagged too.
    const varianceMagnitude = Math.abs(transaction.variance);
    if (varianceMagnitude > 500 || rand() > 0.7) {
      conflicts.push({
        id: `${transaction.caseId}-conflict-1`,
        description: "Variance exceeds typical category mean.",
        severity: varianceMagnitude > 800 ? "high" : "medium",
        checklist: pickFromPool(
          MISSING_CHECKLIST_POOL,
          hashString(`${transaction.caseId}-conflict-1`),
          3,
          {
            vendor: transaction.vendor,
            invoiceId: matchEvidence?.displayInvoiceId ?? "",
            poNumber: matchEvidence?.displayPoNumber ?? ""
          }
        )
      });
    }
    if (rand() > 0.85) {
      conflicts.push({
        id: `${transaction.caseId}-conflict-2`,
        description: "Missing supporting attachment for invoice.",
        severity: "low",
        checklist: pickFromPool(
          EVIDENCE_FOUND_POOL,
          hashString(`${transaction.caseId}-conflict-2`),
          2,
          {
            vendor: transaction.vendor,
            invoiceId: matchEvidence?.displayInvoiceId ?? "",
            poNumber: matchEvidence?.displayPoNumber ?? ""
          }
        )
      });
    }
    const glAmount = Number(matchEvidence?.glAmount);
    const postedAmount =
      matchEvidence?.glAmount && Number.isFinite(glAmount)
        ? glAmount
        : transaction.amount - transaction.variance;
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
        expected: formatCurrency(transaction.amount),
        // Posted amount comes from the GL source row. Variance is expected
        // (invoice) minus posted, matching the recommendation templates.
        actual: formatCurrency(postedAmount),
        status:
          Math.abs(postedAmount - transaction.amount) > 0.005
            ? "mismatch"
            : transaction.variance === 0
              ? "match"
              : "warning"
      },
      {
        id: `${transaction.caseId}-structured-3`,
        field: "Posting window",
        expected: postingExpected,
        actual: postingActual,
        status: postingActual === postingExpected ? "match" : "mismatch"
      }
    ];
    const runLogMessages = [
      "Screened transaction against canonical benchmarks.",
      "Planned evidence pull across Procurement, Receiving, and GL.",
      "Retrieved invoice, PO, and GL artifacts for review.",
      "Ran reference-link and amount checks on source rows.",
      "Reported findings; assembled illustrative recommendation."
    ];
    const runLog: RunLogEntry[] = runLogMessages.map((message, index) => {
      const stepDate = new Date(createdAtBase);
      const hour = 9 + index;
      const minute = Math.floor(hourSeed() * 60);
      stepDate.setUTCHours(hour, minute, 0, 0);
      return {
        id: `${transaction.caseId}-log-${index + 1}`,
        timestamp: stepDate.toISOString(),
        message
      };
    });
    const latestDecision = readDecisions()
      .filter((decision) => decision.caseId === transaction.caseId)
      .pop();
    const closingDecision =
      latestDecision?.decisionType === "CLOSE_AS_RESOLVED" ? latestDecision : undefined;
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
      matchEvidence,
      resolvedAt: transaction.status === CaseStatus.Resolved ? transaction.lastUpdated : undefined,
      closureDisposition: closingDecision?.disposition,
      closedByAnalyst: Boolean(closingDecision),
      residualVariance: closingDecision?.residualVariance
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
    const transaction = this.transactions[transactionIndex];
    const caseFile = await this.getCaseFromTransaction(transaction);
    const check = evaluateDecision({
      decisionType: normalizedRequest.decisionType,
      caseFile,
      rationale: normalizedRequest.rationale,
      evidenceIds: normalizedRequest.evidenceIds
    });
    if (!check.allowed) {
      throw new Error(check.blockers.join(" "));
    }
    const timestamp = new Date().toISOString();
    const decision: ReviewDecision = {
      caseId,
      ...normalizedRequest,
      reviewer: "UI Analyst",
      timestamp,
      ...(normalizedRequest.decisionType === "CLOSE_AS_RESOLVED"
        ? { disposition: check.disposition, residualVariance: transaction.variance }
        : {})
    };
    const decisions = readDecisions();
    decisions.push(decision);
    writeDecisions(decisions);

    const status = statusForDecision(normalizedRequest.decisionType);
    const isClosed = status === CaseStatus.Resolved;
    // Current resolution fields reflect the current state only; earlier
    // closures stay in the decision history.
    this.transactions[transactionIndex] = {
      ...transaction,
      status,
      reviewed: true,
      lastUpdated: timestamp,
      resolvedAt: isClosed ? timestamp : undefined,
      closureDisposition: isClosed ? decision.disposition : undefined,
      closedByAnalyst: isClosed
    };
    caseFile.status = status;
    caseFile.resolvedAt = isClosed ? timestamp : undefined;
    caseFile.closureDisposition = isClosed ? decision.disposition : undefined;
    caseFile.closedByAnalyst = isClosed;
    caseFile.residualVariance = isClosed ? decision.residualVariance : undefined;
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

  // Confirms the claim cites this evidence and the evidence has a document.
  // It does not confirm the document's contents support the claim.
  // Row-level result of the baseline load: accepted, rejected, and duplicate
  // rows with reconciled counts and totals.
  getIngestionReport(source = "baseline"): IngestionReport {
    const report = this.ingestionReports.get(source);
    if (!report) {
      throw new Error(`No ingestion report for ${source}.`);
    }
    return report;
  }

  // Batch 1 rows that pass validation; the report is kept as "batch-1".
  private async loadBatchRows() {
    const file = await parseCsvWithErrors<Record<string, string>>(
      "/data/ui_transactions_batch_1.csv"
    );
    const report = validateTransactionRows(file.data, {
      minCaseIndex: 1,
      maxCaseIndex: 12,
      parseErrors: file.errors
    });
    this.ingestionReports.set("batch-1", report);
    return report.accepted;
  }

  async verifyLink(request: { caseId: string; claimId: string; evidenceId: string }) {
    await this.initialize();
    const transaction = this.transactions.find((item) => item.caseId === request.caseId);
    if (!transaction) {
      return { ok: false };
    }
    const caseFile = await this.getCaseFromTransaction(transaction);
    const claim = caseFile.claims.find((item) => item.id === request.claimId);
    const evidence = caseFile.evidence.find((item) => item.id === request.evidenceId);
    return {
      ok: Boolean(
        claim && evidence?.url && claim.supportedByEvidenceIds.includes(evidence.id)
      )
    };
  }

  async importNextBatch(batchId: number) {
    await this.initialize();
    const normalizedBatchId = Math.max(0, Math.floor(batchId));
    if (normalizedBatchId !== 1) {
      return { importedCount: 0, caseIds: [] };
    }

    if (this.importedBatches.has(normalizedBatchId)) {
      return { importedCount: 0, caseIds: [] };
    }

    const decisions = readDecisions();
    const batchRows = await this.loadBatchRows();
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
    this.importedBatches.set(normalizedBatchId, {
      batchId: normalizedBatchId,
      importedAt: importTimestamp
    });
    writeImportedBatches(Array.from(this.importedBatches.values()));
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
          .map((row) => caseIndexFromCaseId(row.caseId))
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
    const rootCauseLabel = getRootCauseLabel(transaction);
    const caseIndex = caseIndexFromCaseId(transaction.caseId);
    const lookupKey =
      caseIndex != null ? `TX-${1000000 + caseIndex}` : normalizeTxId(transaction.transactionId);
    const canonical = this.canonicalByTxId.get(lookupKey);
    const invoiceId =
      canonical?.invoice_id ??
      `INV-${(hashString(`${caseId}-inv`) % 9000000) + 1000000}`;
    const poNumber =
      canonical?.po_number ?? `PO-${(hashString(`${caseId}-po`) % 90000) + 10000}`;
    const postingDate = new Date(transaction.postingDate);
    const stable = Number.isNaN(postingDate.getTime())
      ? new Date(2025, 0, 1)
      : postingDate;
    const businessDayOffset = 1 + Math.floor(rand() * 5);
    const createdDate = addBusinessDays(stable, businessDayOffset);
    createdDate.setUTCHours(9 + Math.floor(rand() * 7), Math.floor(rand() * 60), 0, 0);
    const submittedDate = new Date(createdDate.getTime() - 2 * 60 * 60 * 1000);
    return {
      caseId,
      summary: `Variance of ${formatCurrency(transaction.variance)} flagged for ${transaction.vendor}.`,
      reasonSummary: reasonSummaryFor(rootCauseLabel),
      priority,
      requestedBy: "Reconciliation Agent",
      submittedAt: submittedDate.toISOString(),
      createdAt: createdDate.toISOString(),
      attemptedSteps: pickFromPool(
        ATTEMPTED_STEPS_POOL,
        hashString(`${caseId}-attempted`),
        3,
        { vendor: transaction.vendor, invoiceId, poNumber }
      ),
      evidenceFound: pickFromPool(
        EVIDENCE_FOUND_POOL,
        hashString(`${caseId}-evidence`),
        3,
        { vendor: transaction.vendor, invoiceId, poNumber }
      ),
      missingChecklist: pickFromPool(
        MISSING_CHECKLIST_POOL,
        hashString(`${caseId}-missing`),
        2,
        { vendor: transaction.vendor, invoiceId, poNumber }
      ),
      suggestedNextActions: pickFromPool(
        SUGGESTED_ACTIONS_POOL,
        hashString(`${caseId}-actions`),
        3,
        { vendor: transaction.vendor, invoiceId, poNumber }
      )
    };
  }
}
