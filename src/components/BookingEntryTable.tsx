import { BookingEntry } from "../types/recommendation";

type BookingEntryTableProps = {
  entry: BookingEntry;
};

export const BookingEntryTable = ({ entry }: BookingEntryTableProps) => {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Posting-ready entry (for review)
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Posting-ready entry lines</caption>
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
                <td className="py-2">{line.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Memo: {entry.memo}
        {entry.period ? ` · Period: ${entry.period}` : ""}
        {entry.effectiveDate ? ` · Date: ${entry.effectiveDate}` : ""}
      </div>
    </div>
  );
};
