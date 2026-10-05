import type { MatchEvidence } from "../types/case";

export type ThreeWayMatchStatus = "pass" | "fail" | "inconclusive";

export interface ThreeWayMatchResult {
  status: ThreeWayMatchStatus;
  // Reference links only: invoice -> PO, receipt -> PO, GL -> invoice.
  referenceStatus: ThreeWayMatchStatus;
  // Economic check: invoice, PO, receipt, and GL amounts agree within tolerance.
  amountStatus: ThreeWayMatchStatus;
  invoiceNote: string;
  poNote: string;
  receiptNote: string;
  glNote: string;
  amountNote: string;
}

// Amounts are compared in cents; anything beyond one cent is a mismatch.
const AMOUNT_TOLERANCE_CENTS = 1;

const normalizeValue = (value?: string) => value?.trim();

const hasValue = (value?: string) => Boolean(normalizeValue(value));

const valuesMatch = (left?: string, right?: string) => {
  const leftNormalized = normalizeValue(left);
  const rightNormalized = normalizeValue(right);
  return Boolean(leftNormalized && rightNormalized && leftNormalized === rightNormalized);
};

const toCents = (value?: string) => {
  const normalized = normalizeValue(value)?.replace(/[$,]/g, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
};

const combine = (statuses: ThreeWayMatchStatus[]): ThreeWayMatchStatus => {
  if (statuses.includes("fail")) {
    return "fail";
  }
  if (statuses.includes("inconclusive")) {
    return "inconclusive";
  }
  return "pass";
};

const evaluateAmounts = (evidence: MatchEvidence) => {
  const amounts = [
    { label: "invoice", cents: toCents(evidence.invoiceAmount) },
    { label: "PO", cents: toCents(evidence.poAmount) },
    { label: "receipt", cents: toCents(evidence.receiptAmount) },
    { label: "GL", cents: toCents(evidence.glAmount) }
  ];
  const missing = amounts.filter((item) => item.cents === null).map((item) => item.label);
  if (missing.length > 0) {
    return {
      status: "inconclusive" as const,
      note: `Amount not available for ${missing.join(", ")}; economic match not established.`
    };
  }
  const values = amounts.map((item) => item.cents as number);
  const spread = Math.max(...values) - Math.min(...values);
  if (spread > AMOUNT_TOLERANCE_CENTS) {
    return {
      status: "fail" as const,
      note: `Amounts disagree: invoice ${evidence.invoiceAmount}, PO ${evidence.poAmount}, receipt ${evidence.receiptAmount}, GL ${evidence.glAmount}.`
    };
  }
  const varianceCents = toCents(evidence.monetaryVariance);
  if (varianceCents) {
    // Documents agree with each other, so they cannot explain the variance.
    return {
      status: "inconclusive" as const,
      note: `Invoice, PO, receipt, and GL amounts agree (${evidence.invoiceAmount}), but the reported ${evidence.monetaryVariance} variance is not explained by them.`
    };
  }
  return {
    status: "pass" as const,
    note: `Invoice, PO, receipt, and GL amounts agree (${evidence.invoiceAmount}).`
  };
};

export const evaluateThreeWayMatch = (
  evidence?: MatchEvidence | null
): ThreeWayMatchResult => {
  if (!evidence) {
    return {
      status: "inconclusive",
      referenceStatus: "inconclusive",
      amountStatus: "inconclusive",
      invoiceNote: "Invoice data not available.",
      poNote: "PO data not available.",
      receiptNote: "Receipt data not available.",
      glNote: "GL posting data not available.",
      amountNote: "Amounts not available."
    };
  }

  const {
    invoiceId,
    poNumber,
    invoicePoNumber,
    receiptId,
    receiptNumber,
    receiptPoNumber,
    glDocumentId,
    glPostingId,
    glInvoiceId
  } = evidence;

  // The invoice's own PO reference is required. Falling back to the PO
  // number would make this check confirm itself.
  const invoicePoComparable = hasValue(invoicePoNumber) && hasValue(poNumber);
  const receiptLabel = receiptId ?? receiptNumber;
  const glLabel = glDocumentId ?? glPostingId;
  // A link to a PO or invoice only counts when the receipt / GL document exists.
  const receiptPoComparable =
    hasValue(receiptLabel) && hasValue(receiptPoNumber) && hasValue(poNumber);
  const glInvoiceComparable =
    hasValue(glLabel) && hasValue(glInvoiceId) && hasValue(invoiceId);

  const invoicePoMatch = valuesMatch(invoicePoNumber, poNumber);
  const receiptPoMatch = valuesMatch(receiptPoNumber, poNumber);
  const glInvoiceMatch = valuesMatch(glInvoiceId, invoiceId);

  const linkStatus = (comparable: boolean, match: boolean): ThreeWayMatchStatus =>
    comparable ? (match ? "pass" : "fail") : "inconclusive";

  const referenceStatus = combine([
    linkStatus(invoicePoComparable, invoicePoMatch),
    linkStatus(receiptPoComparable, receiptPoMatch),
    linkStatus(glInvoiceComparable, glInvoiceMatch)
  ]);
  const amounts = evaluateAmounts(evidence);
  const status = combine([referenceStatus, amounts.status]);

  const invoiceNote = invoicePoComparable
    ? invoicePoMatch
      ? `Invoice ${invoiceId ?? "record"} references PO ${invoicePoNumber}.`
      : `Invoice references PO ${invoicePoNumber}, but PO on record is ${poNumber}.`
    : hasValue(invoicePoNumber)
      ? `Invoice references PO ${invoicePoNumber}, but no PO record found.`
      : hasValue(invoiceId)
        ? "Invoice carries no PO reference in source data."
        : "Invoice data not available.";

  const poNote = hasValue(poNumber)
    ? `PO ${poNumber} present in canonical data.`
    : "PO data not available.";

  const receiptNote = receiptPoComparable
    ? receiptPoMatch
      ? `Receipt ${receiptLabel} tied to PO ${receiptPoNumber}.`
      : `Receipt references PO ${receiptPoNumber}, but PO on record is ${poNumber}.`
    : !hasValue(receiptLabel)
      ? "No receipt record linked to PO."
      : hasValue(receiptPoNumber)
        ? `Receipt references PO ${receiptPoNumber}, but no PO record found.`
        : "Receipt has no PO reference.";

  const glNote = glInvoiceComparable
    ? glInvoiceMatch
      ? `GL posting ${glLabel} references Invoice ${glInvoiceId}.`
      : `GL references Invoice ${glInvoiceId}, but invoice on record is ${invoiceId}.`
    : !hasValue(glLabel)
      ? "No GL posting linked to invoice."
      : hasValue(glInvoiceId)
        ? `GL references Invoice ${glInvoiceId}, but no invoice record found.`
        : "GL posting has no invoice reference.";

  return {
    status,
    referenceStatus,
    amountStatus: amounts.status,
    invoiceNote,
    poNote,
    receiptNote,
    glNote,
    amountNote: amounts.note
  };
};
