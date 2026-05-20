export const VENDOR_DISPLAY_NAMES = [
  "L3Harris Technologies",
  "BAE Systems Inc.",
  "General Dynamics IT",
  "Booz Allen Hamilton",
  "ManTech International",
  "Northrop Grumman",
  "SAIC",
  "CACI",
  "Leidos",
  "Raytheon Technologies",
  "Lockheed Martin",
  "Honeywell Federal",
  "Boeing Defense",
  "Huntington Ingalls",
  "Textron Systems",
  "AECOM Federal",
  "Engility Holdings",
  "Perspecta",
  "Maximus Federal",
  "Peraton",
  "ICF International",
  "CSRA",
  "Vencore",
  "MITRE Corporation",
  "Battelle Memorial",
  "ASRC Federal",
  "PAE Government Services",
  "Vectrus",
  "DynCorp International",
  "Cubic Defense",
  "Elbit Systems of America",
  "Oshkosh Defense",
  "Kratos Defense",
  "AeroVironment",
  "Mercury Systems",
  "Curtiss-Wright Defense",
  "HII Mission Driven",
  "Parsons Corporation",
  "Jacobs Engineering",
  "KBR Federal",
  "Fluor Government Group",
  "Tetra Tech Federal",
  "Charles River Analytics",
  "Sierra Nevada Corp.",
  "Anduril Industries",
  "Palantir Federal",
  "Microsoft Federal",
  "AWS Government",
  "Oracle Government",
  "VMware Federal",
  "Salesforce Government Cloud",
  "SAP NS2",
  "ServiceNow Federal",
  "Red Hat Government",
  "Cisco Federal",
  "Dell Federal",
  "HPE Federal",
  "IBM Federal",
  "Accenture Federal Services",
  "Deloitte Consulting LLP"
];

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
