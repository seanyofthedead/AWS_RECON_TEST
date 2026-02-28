export interface EvidenceLinks {
  invoice?: string;
  po?: string;
  receipt?: string;
  gl?: string;
}

const MAX_CASE_INDEX = 100;

const toCaseFolder = (caseIndex: number) => {
  if (!Number.isFinite(caseIndex) || caseIndex < 1 || caseIndex > MAX_CASE_INDEX) {
    return null;
  }
  return `CASE-${String(caseIndex).padStart(5, "0")}`;
};

export const resolveEvidenceLinks = (caseIndex: number): EvidenceLinks => {
  const caseFolder = toCaseFolder(caseIndex);
  if (!caseFolder) {
    return {};
  }
  const basePath = `/evidence/${caseFolder}`;
  return {
    invoice: `${basePath}/Invoice.pdf`,
    po: `${basePath}/Purchase_Order.pdf`,
    receipt: `${basePath}/Receipt.pdf`,
    gl: `${basePath}/GL_Posting.pdf`
  };
};
