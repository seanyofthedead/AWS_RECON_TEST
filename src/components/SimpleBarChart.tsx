import { ReactNode, memo } from "react";

type SimpleBarChartItem = {
  label: string;
  value: number;
  percentage: number;
  colorClass?: string;
};

type SimpleBarChartProps = {
  title: ReactNode;
  items: SimpleBarChartItem[];
};

export const SimpleBarChart = memo(({ title, items }: SimpleBarChartProps) => {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const width = `${Math.round((item.value / maxValue) * 100)}%`;
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>{item.label}</span>
                <span>
                  {item.value.toLocaleString()} · {item.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${item.colorClass ?? "bg-slate-500"}`}
                  style={{ width }}
                  role="img"
                  aria-label={`${item.label}: ${item.value} (${item.percentage.toFixed(
                    1
                  )}%)`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
