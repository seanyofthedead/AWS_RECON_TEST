import type { MatchEvidence } from "../types/case";

export type ThreeWayMatchStatus = "pass" | "fail" | "inconclusive";

export interface ThreeWayMatchResult {
  status: ThreeWayMatchStatus;
  invoiceNote: string;
  poNote: string;
  receiptNote: string;
  glNote: string;
}

const normalizeValue = (value?: string) => value?.trim();

const hasValue = (value?: string) => Boolean(normalizeValue(value));

const valuesMatch = (left?: string, right?: string) => {
  const leftNormalized = normalizeValue(left);
  const rightNormalized = normalizeValue(right);
  return Boolean(leftNormalized && rightNormalized && leftNormalized === rightNormalized);
};

export const evaluateThreeWayMatch = (
  evidence?: MatchEvidence | null
): ThreeWayMatchResult => {
  if (!evidence) {
    return {
      status: "inconclusive",
      invoiceNote: "Invoice data not available.",
      poNote: "PO data not available.",
      receiptNote: "Receipt data not available.",
      glNote: "GL posting data not available."
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

  const invoicePoReference = invoicePoNumber ?? poNumber;
  const invoicePoMatch = valuesMatch(invoicePoReference, poNumber);
  const receiptPoMatch = valuesMatch(receiptPoNumber, poNumber);
  const glInvoiceMatch = valuesMatch(glInvoiceId, invoiceId);

  const invoicePoComparable = hasValue(invoicePoReference) && hasValue(poNumber);
  const receiptPoComparable = hasValue(receiptPoNumber) && hasValue(poNumber);
  const glInvoiceComparable = hasValue(glInvoiceId) && hasValue(invoiceId);

  const anyExplicitFail =
    (invoicePoComparable && !invoicePoMatch) ||
    (receiptPoComparable && !receiptPoMatch) ||
    (glInvoiceComparable && !glInvoiceMatch);

  const allComparablePass =
    invoicePoComparable &&
    receiptPoComparable &&
    glInvoiceComparable &&
    invoicePoMatch &&
    receiptPoMatch &&
    glInvoiceMatch;

  const status: ThreeWayMatchStatus = allComparablePass
    ? "pass"
    : anyExplicitFail
      ? "fail"
      : "inconclusive";

  const invoiceNote = invoicePoComparable
    ? invoicePoMatch
      ? `Invoice ${invoiceId ?? "record"} references PO ${invoicePoReference}.`
      : `Invoice references PO ${invoicePoReference}, but PO on record is ${poNumber}.`
    : hasValue(invoicePoReference)
      ? `Invoice references PO ${invoicePoReference}, but no PO record found.`
      : hasValue(invoiceId)
        ? "No PO reference found in invoice data."
        : "Invoice data not available.";

  const poNote = hasValue(poNumber)
    ? `PO ${poNumber} present in canonical data.`
    : "PO data not available.";

  const receiptLabel = receiptId ?? receiptNumber;
  const receiptNote = receiptPoComparable
    ? receiptPoMatch
      ? `Receipt ${receiptLabel ?? "record"} tied to PO ${receiptPoNumber}.`
      : `Receipt references PO ${receiptPoNumber}, but PO on record is ${poNumber}.`
    : hasValue(receiptPoNumber)
      ? `Receipt references PO ${receiptPoNumber}, but no PO record found.`
      : hasValue(receiptLabel)
        ? "Receipt has no PO reference."
        : "No receipt record linked to PO.";

  const glLabel = glDocumentId ?? glPostingId;
  const glNote = glInvoiceComparable
    ? glInvoiceMatch
      ? `GL posting ${glLabel ?? "record"} references Invoice ${glInvoiceId}.`
      : `GL references Invoice ${glInvoiceId}, but invoice on record is ${invoiceId}.`
    : hasValue(glInvoiceId)
      ? `GL references Invoice ${glInvoiceId}, but no invoice record found.`
      : hasValue(glLabel)
        ? "GL posting has no invoice reference."
        : "No GL posting linked to invoice.";

  return { status, invoiceNote, poNote, receiptNote, glNote };
};
