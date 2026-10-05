// Fictional supplier names for placeholder vendor IDs (VENDOR-001 is the first).
// Built from Microsoft's fictitious company names; never real companies. The
// evidence PDFs show the same name for each case's vendor ID.
const FICTIONAL_BASES = [
  "Northwind",
  "Contoso",
  "Fabrikam",
  "Datum",
  "Wide World",
  "Litware",
  "Proseware",
  "Woodgrove",
  "Tailspin",
  "Trey",
  "Lucerne",
  "Coho",
  "Alpine",
  "Wingtip",
  "Southridge"
];
const FICTIONAL_LINES = ["Industrial Supply", "Federal Systems", "Logistics", "Field Services"];

export const VENDOR_DISPLAY_NAMES = FICTIONAL_LINES.flatMap((line) =>
  FICTIONAL_BASES.map((base) => `${base} ${line}`)
);

const txIdCache = new Map<number, string>();
const usedTxIds = new Set<string>();

export const realisticTxId = (caseIndex: number): string => {
  const cached = txIdCache.get(caseIndex);
  if (cached) {
    return cached;
  }
  let attempt = 0;
  while (attempt < 256) {
    const mix =
      ((caseIndex * 0x9e3779b1) ^ (0x5a5a5a5a + attempt * 0x12345)) >>> 0;
    const seven = (mix % 9000000) + 1000000;
    const candidate = `TX-${seven}`;
    if (!usedTxIds.has(candidate)) {
      usedTxIds.add(candidate);
      txIdCache.set(caseIndex, candidate);
      return candidate;
    }
    attempt += 1;
  }
  const fallback = `TX-${1000000 + caseIndex * 73}`;
  usedTxIds.add(fallback);
  txIdCache.set(caseIndex, fallback);
  return fallback;
};

export const caseIdForIndex = (caseIndex: number): string =>
  `CASE-${String(caseIndex).padStart(5, "0")}`;

export const caseIndexFromCaseId = (caseId: string): number | null => {
  const match = caseId.match(/CASE-(\d+)/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
};

export const vendorDisplayName = (placeholder?: string): string => {
  if (!placeholder) {
    return "Unknown Vendor";
  }
  const match = placeholder.match(/VENDOR-(\d+)/i);
  if (!match) {
    return placeholder;
  }
  const index = Number(match[1]) - 1;
  if (index < 0 || index >= VENDOR_DISPLAY_NAMES.length) {
    return placeholder;
  }
  return VENDOR_DISPLAY_NAMES[index];
};
