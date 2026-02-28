import { memo } from "react";
import { CaseStatus } from "../types/case";

interface StatusPillProps {
  status: CaseStatus;
}

const statusStyles: Record<CaseStatus, string> = {
  [CaseStatus.ScreenedUnresolved]: "bg-slate-100 text-slate-900",
  [CaseStatus.Resolved]: "bg-emerald-100 text-emerald-900",
  [CaseStatus.Reviewed]: "bg-emerald-100 text-emerald-900",
  [CaseStatus.Escalated]: "bg-amber-100 text-amber-900"
};

const statusLabels: Record<CaseStatus, string> = {
  [CaseStatus.ScreenedUnresolved]: "Open (in queue)",
  [CaseStatus.Resolved]: "Resolved",
  [CaseStatus.Reviewed]: "Reviewed",
  [CaseStatus.Escalated]: "Escalated"
};

export const StatusPill = memo(({ status }: StatusPillProps) => {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
});
