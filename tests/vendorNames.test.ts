import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MockDataProvider } from "../src/api/MockDataProvider";
import { VENDOR_DISPLAY_NAMES } from "../src/utils/demoIdentities";
import { pdfText } from "./pdfText";

// Names the demo used to show, all real companies. None may come back.
const REAL_COMPANIES = [
  "L3Harris", "BAE Systems", "General Dynamics", "Booz Allen", "ManTech", "Northrop",
  "SAIC", "CACI", "Leidos", "Raytheon", "Lockheed", "Honeywell", "Boeing", "Huntington",
  "Textron", "AECOM", "Engility", "Perspecta", "Maximus", "Peraton", "ICF", "CSRA",
  "Vencore", "MITRE", "Battelle", "ASRC", "Vectrus", "DynCorp", "Cubic", "Elbit",
  "Oshkosh", "Kratos", "AeroVironment", "Mercury", "Curtiss-Wright", "Parsons",
  "Jacobs", "Accenture", "Deloitte", "HPE"
];

describe("vendor display names", () => {
  it("are fictional, never real companies", () => {
    for (const name of VENDOR_DISPLAY_NAMES) {
      for (const real of REAL_COMPANIES) {
        expect(name, name).not.toContain(real);
      }
    }
  });

  it("are unique and short enough for the GL posting description cell", () => {
    expect(new Set(VENDOR_DISPLAY_NAMES).size).toBe(VENDOR_DISPLAY_NAMES.length);
    for (const name of VENDOR_DISPLAY_NAMES) {
      expect(name.length, name).toBeLessThanOrEqual(30);
    }
  });

  it("match the supplier named in each case's invoice, PO, and GL documents", async () => {
    const provider = new MockDataProvider();
    await provider.getCases();
    await provider.importNextBatch(1);
    const rows = await provider.getCases();
    expect(rows).toHaveLength(100);
    const mismatched: string[] = [];
    for (const row of rows) {
      const dir = path.resolve(__dirname, "../public/evidence", row.caseId);
      for (const name of ["Invoice.pdf", "Purchase_Order.pdf", "GL_Posting.pdf"]) {
        const file = path.join(dir, name);
        if (!existsSync(file)) continue;
        const expected = `(${row.vendor}, LLC \\(${row.sourceVendorId}\\))`;
        if (!pdfText(file).includes(expected)) mismatched.push(`${row.caseId}/${name}`);
      }
      const gl = path.join(dir, "GL_Posting.pdf");
      if (existsSync(gl) && !pdfText(gl).includes(`(${row.vendor})`)) {
        mismatched.push(`${row.caseId}/GL_Posting.pdf description`);
      }
    }
    expect(mismatched).toEqual([]);
  });
});
