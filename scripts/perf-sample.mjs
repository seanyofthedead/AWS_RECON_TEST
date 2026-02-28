import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import Papa from "papaparse";

const workspaceRoot = process.cwd();
const transactionsPath = path.join(workspaceRoot, "public", "data", "ui_transactions.csv");
const canonicalPath = path.join(workspaceRoot, "public", "data", "canonical_variances.csv");

const now = () => performance.now();

const measure = (label, work) => {
  const start = now();
  const result = work();
  const duration = now() - start;
  return { label, duration, result };
};

const parseCsv = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  return parsed.data;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const operations = [];

const transactionsResult = measure("parse ui_transactions.csv", () => parseCsv(transactionsPath));
operations.push({ label: transactionsResult.label, duration: transactionsResult.duration });

const canonicalResult = measure("parse canonical_variances.csv", () => parseCsv(canonicalPath));
operations.push({ label: canonicalResult.label, duration: canonicalResult.duration });

const mapped = measure("map transactions", () =>
  transactionsResult.result.map((row, index) => {
    const transactionId =
      row.transactionId ?? row.TransactionId ?? row.TransactionID ?? `TX-${index + 1}`;
    const amount = toNumber(row.amount ?? row.Amount);
    const variance = toNumber(row.variance ?? row.Variance);
    return {
      transactionId,
      vendor: row.vendor ?? row.Vendor ?? "Unknown Vendor",
      amount,
      variance,
      caseId: row.caseId ?? row.CaseId ?? `CASE-${transactionId}`,
      status: row.Status ?? "SCREENED_UNRESOLVED"
    };
  })
);
operations.push({ label: mapped.label, duration: mapped.duration });

const threshold = 5;
const metrics = measure("executive metrics", () => {
  const totals = { total: mapped.result.length, within: 0, above: 0 };
  mapped.result.forEach((row) => {
    const absVariance = Math.abs(row.variance);
    const absAmount = Math.abs(row.amount);
    const variancePercent = absAmount > 0 ? (absVariance / absAmount) * 100 : 0;
    if (variancePercent > threshold) {
      totals.above += 1;
    } else {
      totals.within += 1;
    }
  });
  return totals;
});
operations.push({ label: metrics.label, duration: metrics.duration });

const topSort = measure("sort top variances", () =>
  [...mapped.result]
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 10)
);
operations.push({ label: topSort.label, duration: topSort.duration });

const slowest = operations
  .sort((a, b) => b.duration - a.duration)
  .slice(0, 5)
  .map((item) => ({ ...item, duration: Number(item.duration.toFixed(2)) }));

console.log("Perf sample (node):");
console.table(slowest);
