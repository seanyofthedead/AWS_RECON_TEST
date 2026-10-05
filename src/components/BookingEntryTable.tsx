import { BookingEntry } from "../types/recommendation";
import { formatCurrency } from "../utils/formatCurrency";

type BookingEntryTableProps = {
  entry: BookingEntry;
};

export const BookingEntryTable = ({ entry }: BookingEntryTableProps) => {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Illustrative entry lines
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Illustrative entry lines</caption>
          <thead className="text-slate-500">
            <tr>
              <th scope="col" className="pb-2 pr-4">Entry Type</th>
              <th scope="col" className="pb-2 pr-4">Account</th>
              <th scope="col" className="pb-2">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entry.lines.map((line, index) => (
              <tr key={`${line.account}-${line.direction}-${index}`}>
                <td className="py-2 pr-4 font-semibold text-slate-900">{line.direction}</td>
                <td className="py-2 pr-4">{line.account}</td>
                <td className="py-2">{formatCurrency(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 space-y-1 text-xs text-slate-500">
        <div>Memo: {entry.memo}</div>
        {entry.period ? (
          <div>
            Service period {entry.servicePeriod} · Posting period {entry.period} (FY
            {entry.fiscalYear}) · Effective {entry.effectiveDate}
          </div>
        ) : null}
        {entry.priorPeriodAdjustment ? (
          <div className="text-amber-800">
            Service period {entry.servicePeriod} is closed, so this posts in {entry.period} as a
            prior-period adjustment and needs approval. Period status comes from a demo calendar.
          </div>
        ) : null}
        {entry.reversal ? (
          <div>
            Reversal scheduled for {entry.reversal.date} (period {entry.reversal.period}).
          </div>
        ) : null}
      </div>
    </div>
  );
};
