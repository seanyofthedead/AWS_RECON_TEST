import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";

const publicDir = path.resolve(__dirname, "../public");

// ReportLab streams are ASCII85-wrapped Flate data.
const ascii85Decode = (input: string) => {
  const text = input.replace(/\s+/g, "").replace(/~>$/, "");
  const bytes: number[] = [];
  let group: number[] = [];
  const flush = (count: number) => {
    let value = 0;
    for (const digit of group) value = value * 85 + digit;
    const chunk = [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
    bytes.push(...chunk.slice(0, count));
  };
  for (const char of text) {
    if (char === "z" && group.length === 0) {
      bytes.push(0, 0, 0, 0);
      continue;
    }
    group.push(char.charCodeAt(0) - 33);
    if (group.length === 5) {
      flush(4);
      group = [];
    }
  }
  if (group.length > 0) {
    const count = group.length - 1;
    while (group.length < 5) group.push(84);
    flush(count);
  }
  return Buffer.from(bytes);
};

const pdfText = (file: string) => {
  const data = readFileSync(file).toString("latin1");
  const streams = [...data.matchAll(/<<([^]*?)>>\s*stream\r?\n([^]*?)endstream/g)];
  return streams
    .map(([, header, body]) => {
      let raw = Buffer.from(body, "latin1");
      if (header.includes("ASCII85Decode")) raw = ascii85Decode(body);
      if (header.includes("FlateDecode")) raw = inflateSync(raw);
      return raw.toString("latin1");
    })
    .join("\n");
};

const money = (value: string) =>
  `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

describe("GL posting evidence documents", () => {
  // Rows whose GL amount differs from the invoice drive amount-match failures,
  // so their GL document must not contradict the source row.
  it("show the GL source amount on cases whose GL disagrees with the invoice", () => {
    const csv = readFileSync(path.join(publicDir, "data/canonical_variances.csv"), "utf8");
    const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data;
    let checked = 0;
    for (const row of rows) {
      const caseId = `CASE-${String(Number(row.TransactionID.slice(3)) - 1000000).padStart(5, "0")}`;
      const file = path.join(publicDir, "evidence", caseId, "GL_Posting.pdf");
      if (!existsSync(file) || !row.gl_amount || Number(row.gl_amount) === Number(row.Amount)) {
        continue;
      }
      const text = pdfText(file);
      expect(text, caseId).toContain(`(${money(row.gl_amount)})`);
      expect(text, caseId).not.toContain(`(${money(row.Amount)})`);
      checked += 1;
    }
    expect(checked).toBe(2);
  });
});
