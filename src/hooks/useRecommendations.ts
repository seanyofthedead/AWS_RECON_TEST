import { useMemo } from "react";
import { TransactionRow } from "../types/transaction";
import {
  getEscalationRecommendation,
  getPrimaryRecommendation,
  getProposedRecommendationId,
  getRecommendationsForCase
} from "../utils/recommendations";

type UseRecommendationsParams = {
  caseId: string;
  transaction?: TransactionRow;
  aiReason?: string;
  includeEscalationAttachment?: boolean;
};

export const useRecommendations = ({
  caseId,
  transaction,
  aiReason,
  includeEscalationAttachment
}: UseRecommendationsParams) => {
  return useMemo(() => {
    const attached = includeEscalationAttachment
      ? getEscalationRecommendation(caseId)
      : undefined;
    const recommendations = getRecommendationsForCase({ caseId, transaction, aiReason });
    const primary = attached ?? getPrimaryRecommendation({ caseId, transaction, aiReason });
    const proposedId = getProposedRecommendationId(caseId);
    const list = attached ? [attached, ...recommendations] : recommendations;
    return {
      recommendations: list,
      primary,
      proposedId
    };
  }, [caseId, transaction, aiReason, includeEscalationAttachment]);
};
