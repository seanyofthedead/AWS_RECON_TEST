import { memo } from "react";

type KpiCardProps = {
  label: string;
  value: string;
  helperText?: string;
};

export const KpiCard = memo(({ label, value, helperText }: KpiCardProps) => {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {helperText ? <p className="mt-1 text-xs text-slate-500">{helperText}</p> : null}
    </div>
  );
});
