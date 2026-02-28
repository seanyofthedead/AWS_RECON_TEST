import { memo } from "react";
import { ConfidenceBand } from "../types/case";

interface ConfidencePillProps {
  band: ConfidenceBand;
  score: number;
}

const bandStyles: Record<ConfidenceBand, string> = {
  [ConfidenceBand.High]: "bg-emerald-100 text-emerald-900",
  [ConfidenceBand.Medium]: "bg-amber-100 text-amber-900",
  [ConfidenceBand.Low]: "bg-rose-100 text-rose-900"
};

const bandLabels: Record<ConfidenceBand, string> = {
  [ConfidenceBand.High]: "High",
  [ConfidenceBand.Medium]: "Medium",
  [ConfidenceBand.Low]: "Low"
};

export const ConfidencePill = memo(({ band, score }: ConfidencePillProps) => {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${bandStyles[band]}`}
    >
      {bandLabels[band]} ({Math.round(score * 100)}%)
    </span>
  );
});
