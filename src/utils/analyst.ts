import { hashString } from "./hash";

const analystNames = ["Analyst A", "Analyst B", "Analyst C", "Analyst D"] as const;

export const getAnalystName = (caseId: string): string => {
  const index = hashString(caseId) % analystNames.length;
  return analystNames[index];
};

export const getAnalystOptions = () => [...analystNames];
