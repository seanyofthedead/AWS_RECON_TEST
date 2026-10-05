// Row-level validation for transaction CSVs. Invalid rows are rejected with
// reasons instead of being repaired, duplicates are reported as exceptions,
// and source totals reconcile to accepted + rejected + duplicate rows.

export interface RejectedRow {
  line: number;
  transactionId: string;
  reasons: string[];
}

export interface DuplicateRow {
  line: number;
  transactionId: string;
  amount: number | null;
  firstLine: number;
}

export interface IngestionTotals {
  sourceRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  // Amount totals cover rows whose Amount parses; the rest are counted in
  // unparseableAmountRows.
  sourceAmount: number;
  acceptedAmount: number;
  rejectedAmount: number;
  duplicateAmount: number;
  unparseableAmountRows: number;
}

export interface IngestionReport {
  accepted: Record<string, string>[];
  rejected: RejectedRow[];
  duplicates: DuplicateRow[];
  parseErrors: string[];
  totals: IngestionTotals;
}

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

const pick = (row: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
};

const parseAmount = (value: string) => (NUMBER_PATTERN.test(value) ? Number(value) : null);

const isValidDate = (value: string) => {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
};

const caseIndexOf = (transactionId: string) => {
  const match = transactionId.match(/^TX-(\d+)$/i);
  return match ? Number(match[1]) - 1000000 : null;
};

const toCents = (amount: number | null) => (amount === null ? 0 : Math.round(amount * 100));

export const validateTransactionRows = (
  rows: Record<string, string>[],
  options: { minCaseIndex?: number; maxCaseIndex?: number; parseErrors?: string[] } = {}
): IngestionReport => {
  const accepted: Record<string, string>[] = [];
  const rejected: RejectedRow[] = [];
  const duplicates: DuplicateRow[] = [];
  const firstLineById = new Map<string, number>();
  const cents = { source: 0, accepted: 0, rejected: 0, duplicate: 0 };
  let unparseableAmountRows = 0;

  rows.forEach((row, index) => {
    // Line 1 is the header row.
    const line = index + 2;
    const transactionId = pick(row, "TransactionID", "transactionId", "transaction_id").toUpperCase();
    const amountText = pick(row, "Amount", "amount");
    const varianceText = pick(row, "Variance", "variance");
    const dateText = pick(row, "PostingDate", "postingDate");
    const confidenceText = pick(row, "Confidence", "confidenceScore");
    const amount = parseAmount(amountText);
    const reasons: string[] = [];

    if (!transactionId) {
      reasons.push("TransactionID is missing");
    } else {
      const caseIndex = caseIndexOf(transactionId);
      const { minCaseIndex, maxCaseIndex } = options;
      if (
        (minCaseIndex !== undefined || maxCaseIndex !== undefined) &&
        (caseIndex === null ||
          (minCaseIndex !== undefined && caseIndex < minCaseIndex) ||
          (maxCaseIndex !== undefined && caseIndex > maxCaseIndex))
      ) {
        reasons.push(
          `TransactionID ${transactionId} is outside the expected case range ${minCaseIndex ?? ""}-${maxCaseIndex ?? ""}`
        );
      }
    }
    if (amount === null) {
      reasons.push(amountText ? `Amount is not a number: "${amountText}"` : "Amount is missing");
    }
    if (parseAmount(varianceText) === null) {
      reasons.push(varianceText ? `Variance is not a number: "${varianceText}"` : "Variance is missing");
    }
    if (!dateText) {
      reasons.push("PostingDate is missing");
    } else if (!isValidDate(dateText)) {
      reasons.push(`PostingDate is not a valid date: "${dateText}"`);
    }
    const serviceDateText = pick(row, "ServiceDate", "service_date");
    if (serviceDateText && !isValidDate(serviceDateText)) {
      reasons.push(`ServiceDate is not a valid date: "${serviceDateText}"`);
    }
    if (!confidenceText) {
      reasons.push("Confidence is missing");
    } else {
      const confidence = parseAmount(confidenceText);
      if (confidence === null || confidence < 0 || confidence > 1) {
        reasons.push(`Confidence must be between 0 and 1: "${confidenceText}"`);
      }
    }

    if (amount === null) {
      unparseableAmountRows += 1;
    }
    cents.source += toCents(amount);

    if (reasons.length > 0) {
      rejected.push({ line, transactionId, reasons });
      cents.rejected += toCents(amount);
      return;
    }
    const firstLine = firstLineById.get(transactionId);
    if (firstLine !== undefined) {
      duplicates.push({ line, transactionId, amount, firstLine });
      cents.duplicate += toCents(amount);
      return;
    }
    firstLineById.set(transactionId, line);
    accepted.push(row);
    cents.accepted += toCents(amount);
  });

  return {
    accepted,
    rejected,
    duplicates,
    parseErrors: options.parseErrors ?? [],
    totals: {
      sourceRows: rows.length,
      acceptedRows: accepted.length,
      rejectedRows: rejected.length,
      duplicateRows: duplicates.length,
      sourceAmount: cents.source / 100,
      acceptedAmount: cents.accepted / 100,
      rejectedAmount: cents.rejected / 100,
      duplicateAmount: cents.duplicate / 100,
      unparseableAmountRows
    }
  };
};
