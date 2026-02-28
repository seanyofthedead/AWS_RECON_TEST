import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import process from "process";
import PDFDocument from "pdfkit";
import Papa from "papaparse";

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "public", "data");
const EVIDENCE_DIR = path.join(ROOT_DIR, "public", "evidence");
const INDEX_PATH = path.join(EVIDENCE_DIR, "evidence_index.json");

const DEFAULT_LIMIT = 30;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeHeader = (header) => {
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

const normalizeRecord = (row) => {
  return Object.entries(row).reduce((acc, [key, value]) => {
    const normalizedKey = normalizeHeader(key);
    if (normalizedKey) {
      acc[normalizedKey] = value;
    }
    return acc;
  }, {});
};

const normalizeTxId = (rawId) => {
  if (!rawId) {
    return "";
  }
  const cleaned = rawId.trim().toUpperCase().replace(/\s+/g, "");
  if (cleaned.startsWith("TRANSACTION-")) {
    return `TX-${cleaned.slice("TRANSACTION-".length)}`;
  }
  if (cleaned.startsWith("TX-")) {
    return cleaned;
  }
  return cleaned;
};

const hashString = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
};

const mulberry32 = (seed) => {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const safeSlug = (value) => {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const splitEvidenceDocIds = (raw) => {
  if (!raw) {
    return [];
  }
  return String(raw)
    .split(/[;,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

const toTitleCase = (value) =>
  value.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());

const cleanReason = (raw) => {
  if (!raw) {
    return "";
  }
  const trimmed = String(raw).trim();
  if (!trimmed) {
    return "";
  }
  const upper = trimmed.toUpperCase();
  const emptyValues = new Set([
    "N/A",
    "NA",
    "UNKNOWN",
    "NEEDS REVIEW",
    "UNKNOWN / NEEDS REVIEW"
  ]);
  if (emptyValues.has(upper)) {
    return "";
  }
  const normalized = trimmed.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return toTitleCase(normalized);
};

const bucketFromCanonical = (raw) => {
  const cleaned = cleanReason(raw);
  if (!cleaned) {
    return "OTHER";
  }
  const normalized = cleaned.toLowerCase();
  const directMap = {
    "timing difference": "TIMING",
    "accrual reversal": "TIMING",
    "missing receipt": "QUANTITY",
    "wrong po reference": "CONTRACT",
    "reference data misalignment": "CONTRACT",
    "stale master data": "CONTRACT",
    "manual entry error": "OTHER",
    "conversion error": "OTHER",
    "unknown / needs review": "OTHER"
  };
  if (directMap[normalized]) {
    return directMap[normalized];
  }
  if (normalized.includes("timing") || normalized.includes("period") || normalized.includes("cutoff")) {
    return "TIMING";
  }
  if (
    normalized.includes("quantity") ||
    normalized.includes("receipt") ||
    normalized.includes("short ship") ||
    normalized.includes("partial receipt")
  ) {
    return "QUANTITY";
  }
  if (
    normalized.includes("contract") ||
    normalized.includes("po reference") ||
    normalized.includes("reference data") ||
    normalized.includes("master data")
  ) {
    return "CONTRACT";
  }
  if (
    normalized.includes("pricing") ||
    normalized.includes("rate") ||
    normalized.includes("unit price") ||
    normalized.includes("price variance")
  ) {
    return "PRICING";
  }
  if (normalized.includes("manual entry") || normalized.includes("conversion") || normalized.includes("unknown")) {
    return "OTHER";
  }
  return "OTHER";
};

const parseCsv = async (filePath) => {
  const text = await fsp.readFile(filePath, "utf8");
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true
  });
  return result.data;
};

const loadEvidenceIndex = async () => {
  try {
    const raw = await fsp.readFile(INDEX_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeEvidenceIndex = async (index) => {
  const sorted = Object.keys(index)
    .sort()
    .reduce((acc, key) => {
      acc[key] = index[key];
      return acc;
    }, {});
  await fsp.mkdir(EVIDENCE_DIR, { recursive: true });
  await fsp.writeFile(INDEX_PATH, JSON.stringify(sorted, null, 2));
};

const renderPdf = async ({ targetPath, payload }) => {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(targetPath)) {
    console.log(`SKIP (exists): ${targetPath}`);
    return;
  }
  console.log(`WRITE: ${targetPath}`);
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 48 });
    const stream = fs.createWriteStream(targetPath);
    doc.pipe(stream);

    doc.fontSize(18).fillColor("#111827").text(payload.title, { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#6B7280").text("DEMO - FICTIONAL", { align: "left" });
    doc.moveDown(1);

    doc.fontSize(12).fillColor("#111827").text("Case Summary", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#111827");
    doc.text(`Case ID: ${payload.caseId}`);
    doc.text(`Transaction ID: ${payload.transactionId}`);
    doc.text(`Vendor: ${payload.vendor}`);
    doc.text(`Posting Date: ${payload.postingDate}`);
    doc.moveDown(0.75);

    doc.fontSize(12).fillColor("#111827").text("Key Identifiers", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#111827");
    payload.identifiers.forEach((line) => {
      doc.text(line);
    });
    doc.moveDown(0.75);

    doc.fontSize(12).fillColor("#111827").text("Narrative", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#111827");
    doc.text(payload.narrative, { width: 500 });

    doc.save();
    doc.rotate(-35, { origin: [200, 300] });
    doc.fontSize(42).fillColor("#9CA3AF").opacity(0.15).text("DEMO - FICTIONAL", {
      align: "center"
    });
    doc.restore();

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
};

const truncate = (value, limit = 240) => {
  if (!value) {
    return "No narrative available.";
  }
  const text = String(value);
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit).trim()}...`;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = { limit: DEFAULT_LIMIT, caseId: null, clean: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit") {
      result.limit = Number(args[i + 1] ?? DEFAULT_LIMIT);
      i += 1;
    } else if (arg === "--caseId") {
      result.caseId = args[i + 1] ?? null;
      i += 1;
    } else if (arg === "--clean") {
      result.clean = true;
    }
  }
  return result;
};

const buildCanonicalIndex = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    if (!row.transactionid) {
      return;
    }
    const key = normalizeTxId(row.transactionid);
    if (!map.has(key)) {
      map.set(key, row);
    }
  });
  return map;
};

const getCanonicalForCase = ({ canonicalMap, canonicalRows, caseId, transactionId }) => {
  const normalizedId = normalizeTxId(transactionId);
  const direct = canonicalMap.get(normalizedId);
  if (direct) {
    return direct;
  }
  const seed = hashString(caseId);
  const rand = mulberry32(seed);
  const sample = canonicalRows[Math.floor(rand() * canonicalRows.length)];
  return sample ?? {};
};

const buildIdentifiers = (canonical) => {
  const identifiers = [];
  if (canonical.po_number) {
    identifiers.push(`PO Number: ${canonical.po_number}`);
  }
  if (canonical.invoice_id) {
    identifiers.push(`Invoice ID: ${canonical.invoice_id}`);
  }
  if (canonical.doc_number) {
    identifiers.push(`Document Number: ${canonical.doc_number}`);
  }
  if (canonical.evidence_doc_ids) {
    identifiers.push(`Evidence Doc IDs: ${canonical.evidence_doc_ids}`);
  }
  if (identifiers.length === 0) {
    identifiers.push("No canonical identifiers available.");
  }
  return identifiers;
};

const main = async () => {
  const { limit, caseId, clean } = parseArgs();
  if (clean) {
    await fsp.rm(EVIDENCE_DIR, { recursive: true, force: true });
  }

  const uiTransactions = await parseCsv(path.join(DATA_DIR, "ui_transactions.csv"));
  const canonicalRowsRaw = await parseCsv(path.join(DATA_DIR, "canonical_variances.csv"));
  const canonicalRows = canonicalRowsRaw.map((row) => normalizeRecord(row));
  const canonicalMap = buildCanonicalIndex(canonicalRows);

  const normalizedTransactions = uiTransactions.map((row) => normalizeRecord(row));
  const selected = caseId
    ? normalizedTransactions.filter((row) => {
        const transactionId = row.transactionid ?? row.transaction_id ?? "";
        const computedCaseId = row.caseid ?? row.case_id ?? `CASE-${transactionId}`;
        return computedCaseId === caseId;
      })
    : normalizedTransactions.slice(0, limit);

  const evidenceIndex = await loadEvidenceIndex();

  for (const row of selected) {
    const transactionId = row.transactionid ?? row.transaction_id ?? "";
    if (!transactionId) {
      continue;
    }
    const caseIdValue = row.caseid ?? row.case_id ?? `CASE-${transactionId}`;
    const canonical = getCanonicalForCase({
      canonicalMap,
      canonicalRows,
      caseId: caseIdValue,
      transactionId
    });

    const docId =
      canonical.doc_number ||
      splitEvidenceDocIds(canonical.evidence_doc_ids)[0] ||
      `DOC-${transactionId}`;

    const bucketSource = canonical.ai_reason || canonical.variance_category;
    const bucket = bucketFromCanonical(bucketSource);

    const fileNames = [
      `E1-CONTRACT-${safeSlug(transactionId)}-${safeSlug(docId)}.pdf`,
      `E2-INVOICE-LOG-${safeSlug(transactionId)}.pdf`,
      `E3-POLICY-${safeSlug(transactionId)}-${safeSlug(bucket)}.pdf`
    ];

    const evidenceIds = [
      `${caseIdValue}-evidence-1`,
      `${caseIdValue}-evidence-2`,
      `${caseIdValue}-evidence-3`
    ];

    const caseDir = path.join(EVIDENCE_DIR, caseIdValue);
    await fsp.mkdir(caseDir, { recursive: true });

    const postingDate = row.postingdate ?? row.posting_date ?? "2025-01-01";
    const vendor = row.vendor ?? "Generic Vendor";

    const narrative = truncate(
      `${canonical.commentary ?? ""} ${canonical.next_steps ?? ""}`.trim()
    );

    const identifiers = buildIdentifiers(canonical);

    const payloads = [
      {
        title: "Contract Addendum Evidence",
        caseId: caseIdValue,
        transactionId,
        vendor,
        postingDate,
        identifiers,
        narrative
      },
      {
        title: "Invoice Sync Log Evidence",
        caseId: caseIdValue,
        transactionId,
        vendor,
        postingDate,
        identifiers,
        narrative
      },
      {
        title: "Policy Threshold Check",
        caseId: caseIdValue,
        transactionId,
        vendor,
        postingDate,
        identifiers,
        narrative
      }
    ];

    for (let i = 0; i < fileNames.length; i += 1) {
      const fileName = fileNames[i];
      const evidenceId = evidenceIds[i];
      const targetPath = path.join(caseDir, fileName);
      await renderPdf({ targetPath, payload: payloads[i] });
      const url = `/evidence/${caseIdValue}/${fileName}`;
      const existingUrl = evidenceIndex[evidenceId];
      if (existingUrl) {
        const existingPath = path.join(
          ROOT_DIR,
          "public",
          existingUrl.replace(/^\/evidence\//, "evidence/")
        );
        if (fs.existsSync(existingPath)) {
          continue;
        }
      }
      evidenceIndex[evidenceId] = url;
    }
  }

  await writeEvidenceIndex(evidenceIndex);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
