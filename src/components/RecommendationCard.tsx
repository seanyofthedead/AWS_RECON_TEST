import { useState } from "react";
import { InfoTooltip } from "./InfoTooltip";
import { BookingEntryTable } from "./BookingEntryTable";
import { Recommendation } from "../types/recommendation";

type RecommendationCardProps = {
  recommendation: Recommendation;
  proposed?: boolean;
  onCopyEntry?: () => void;
  onPropose?: () => void;
  onEscalate?: () => void;
  showActions?: boolean;
};

export const RecommendationCard = ({
  recommendation,
  proposed,
  onCopyEntry,
  onPropose,
  onEscalate,
  showActions = true
}: RecommendationCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const steps = expanded ? recommendation.nextSteps : recommendation.nextSteps.slice(0, 3);
  const hasMore = recommendation.nextSteps.length > 3;
  const confidenceStyles: Record<Recommendation["confidence"], string> = {
    High: "bg-emerald-100 text-emerald-900",
    Medium: "bg-amber-100 text-amber-900",
    Low: "bg-rose-100 text-rose-900"
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          Recommended Fix
          <InfoTooltip
            label="Recommended Fix"
            text="Proposed steps based on root cause."
          />
        </div>
        {proposed ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
            Proposed
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-sm font-semibold text-slate-900">{recommendation.title}</div>

      <ul className="mt-2 space-y-1 text-sm text-slate-700">
        {steps.map((step) => (
          <li key={step}>• {step}</li>
        ))}
      </ul>
      {hasMore ? (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-slate-700 hover:underline"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Recommendation confidence
          <InfoTooltip
            label="Recommendation confidence"
            text="AI certainty in the recommended fix."
          />
        </span>
        <span
          className={`rounded-full px-2 py-1 font-semibold ${
            confidenceStyles[recommendation.confidence]
          }`}
        >
          {recommendation.confidence}
        </span>
        <span>Why: {recommendation.rationale}</span>
      </div>

      {recommendation.bookingEntry ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Illustrative adjustment (not posting-ready)
            <InfoTooltip
              label="Illustrative adjustment"
              text="Generic accounts from a rules template. It lacks validated account IDs, fund/TAS, and other dimensions, and needs a finance-approved accounting profile before posting."
            />
          </div>
          <BookingEntryTable entry={recommendation.bookingEntry} />
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          No journal proposed. This is an operational or evidence step; propose an entry only
          after its accounting impact is confirmed.
        </p>
      )}

      {showActions ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {recommendation.bookingEntry ? (
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onCopyEntry}
            >
              Copy entry
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
            onClick={onPropose}
          >
            Mark as Proposed (local note)
          </button>
          <button
            type="button"
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            onClick={onEscalate}
          >
            Escalate with this fix
          </button>
        </div>
      ) : null}
    </section>
  );
};
