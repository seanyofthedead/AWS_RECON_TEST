import { existsSync, readFileSync, readdirSync } from "node:fs";
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

  it("show the source amounts on every case's invoice, PO, and GL documents", () => {
    const csv = readFileSync(path.join(publicDir, "data/canonical_variances.csv"), "utf8");
    const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data;
    const mismatches: string[] = [];
    let checked = 0;
    for (const row of rows) {
      const caseId = `CASE-${String(Number(row.TransactionID.slice(3)) - 1000000).padStart(5, "0")}`;
      const expected: Array<[string, string | undefined]> = [
        ["Invoice.pdf", row.Amount],
        ["Purchase_Order.pdf", row.po_amount],
        ["GL_Posting.pdf", row.gl_amount]
      ];
      for (const [name, amount] of expected) {
        const file = path.join(publicDir, "evidence", caseId, name);
        if (!amount || !existsSync(file)) continue;
        checked += 1;
        const text = pdfText(file);
        if (!text.includes(`(${money(amount)})`)) {
          mismatches.push(`${caseId}/${name} lacks ${money(amount)}`);
        }
        // Some unit price on the invoice or PO must explain its total
        // (quantity is the feeder quantity; prices are rounded to cents).
        const qty = Number(row.Feeder_Qty);
        if (name !== "GL_Posting.pdf" && qty > 0) {
          const prices = [...text.matchAll(/\(\$([\d,]+\.\d\d)\)/g)].map((m) =>
            Number(m[1].replace(/,/g, ""))
          );
          if (!prices.some((price) => Math.abs(price * qty - Number(amount)) <= qty * 0.005 + 0.01)) {
            mismatches.push(`${caseId}/${name} has no unit price for ${qty} x ${money(amount)}`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(checked).toBeGreaterThan(250);
  });

  it("do not clip the start of their own content", () => {
    const clipped: string[] = [];
    const clip = /n ([\d.]+) [\d.]+ [\d.]+ [\d.]+ re W\*? n\nq\n1 0 0 1 ([\d.]+) [\d.]+ cm/g;
    for (const caseDir of readdirSync(path.join(publicDir, "evidence"))) {
      if (!/^CASE-\d{5}$/.test(caseDir)) continue;
      for (const name of readdirSync(path.join(publicDir, "evidence", caseDir))) {
        const text = pdfText(path.join(publicDir, "evidence", caseDir, name));
        for (const [, clipX, originX] of text.matchAll(clip)) {
          if (Number(originX) < Number(clipX)) clipped.push(`${caseDir}/${name}`);
        }
      }
    }
    expect(clipped).toEqual([]);
  });

  it("state the GL reconciliation note as a quantity difference, not dollars", () => {
    const csv = readFileSync(path.join(publicDir, "data/canonical_variances.csv"), "utf8");
    const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data;
    const wrong: string[] = [];
    for (const row of rows) {
      const caseId = `CASE-${String(Number(row.TransactionID.slice(3)) - 1000000).padStart(5, "0")}`;
      const file = path.join(publicDir, "evidence", caseId, "GL_Posting.pdf");
      if (!existsSync(file)) continue;
      const units = Number(row.Feeder_Qty) - Number(row.ERP_Qty);
      const note = `( Quantity difference, feeder minus ERP: ${units} ${Math.abs(units) === 1 ? "unit" : "units"}.)`;
      if (!pdfText(file).includes(note)) wrong.push(caseId);
    }
    expect(wrong).toEqual([]);
  });

  it("draw no missing-glyph markers", () => {
    // ReportLab draws a ZapfDingbats square (font F4) for characters its
    // Helvetica encoding lacks, such as a non-breaking hyphen.
    const marked: string[] = [];
    for (const caseDir of readdirSync(path.join(publicDir, "evidence"))) {
      if (!/^CASE-\d{5}$/.test(caseDir)) continue;
      for (const name of readdirSync(path.join(publicDir, "evidence", caseDir))) {
        if (/\/F4 [\d.]+ Tf/.test(pdfText(path.join(publicDir, "evidence", caseDir, name)))) {
          marked.push(`${caseDir}/${name}`);
        }
      }
    }
    expect(marked).toEqual([]);
  });
});
