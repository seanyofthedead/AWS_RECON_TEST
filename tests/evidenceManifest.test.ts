import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveEvidenceLinks } from "../src/utils/evidenceResolver";

const evidenceDir = path.resolve(__dirname, "../public/evidence");
const CONTRACT_FILES = ["GL_Posting.pdf", "Invoice.pdf", "Purchase_Order.pdf", "Receipt.pdf"];

type Manifest = {
  version: number;
  cases: Record<string, Record<string, string>>;
};

const sha256 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

describe("evidence manifest (F23)", () => {
  const manifest = JSON.parse(readFileSync(path.join(evidenceDir, "manifest.json"), "utf8")) as Manifest;

  it("lists the four contract documents for each of the 100 cases", () => {
    expect(manifest.version).toBeGreaterThanOrEqual(1);
    expect(Object.keys(manifest.cases)).toHaveLength(100);
    for (let index = 1; index <= 100; index += 1) {
      const caseId = `CASE-${String(index).padStart(5, "0")}`;
      expect(Object.keys(manifest.cases[caseId]).sort(), caseId).toEqual(CONTRACT_FILES);
      // The paths the app links to are exactly the manifest's files.
      const links = Object.values(resolveEvidenceLinks(index)).map((link) => path.basename(link!));
      expect(links.sort(), caseId).toEqual(CONTRACT_FILES);
    }
  });

  it("matches the committed evidence files byte for byte", () => {
    const drift: string[] = [];
    for (const [caseId, files] of Object.entries(manifest.cases)) {
      for (const [name, hash] of Object.entries(files)) {
        if (sha256(path.join(evidenceDir, caseId, name)) !== hash) drift.push(`${caseId}/${name}`);
      }
    }
    expect(drift).toEqual([]);
  });

  it("has no evidence files outside the manifest", () => {
    const extra: string[] = [];
    for (const entry of readdirSync(evidenceDir)) {
      if (entry === "manifest.json") continue;
      const full = path.join(evidenceDir, entry);
      if (!statSync(full).isDirectory() || !manifest.cases[entry]) {
        extra.push(entry);
        continue;
      }
      for (const name of readdirSync(full)) {
        if (!manifest.cases[entry][name]) extra.push(`${entry}/${name}`);
      }
    }
    expect(extra).toEqual([]);
  });
});
