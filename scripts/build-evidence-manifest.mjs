// Writes public/evidence/manifest.json: the four contract documents for each
// case folder, with SHA-256 hashes. tests/evidenceManifest.test.ts fails if
// the committed files drift from it; tests/evidenceDocuments.test.ts checks
// their contents against the source CSVs. Run after replacing evidence files.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const evidenceDir = path.resolve("public/evidence");
const CONTRACT_FILES = ["GL_Posting.pdf", "Invoice.pdf", "Purchase_Order.pdf", "Receipt.pdf"];

const cases = {};
for (const caseId of readdirSync(evidenceDir).filter((name) => /^CASE-\d{5}$/.test(name)).sort()) {
  cases[caseId] = {};
  for (const name of CONTRACT_FILES) {
    const data = readFileSync(path.join(evidenceDir, caseId, name));
    cases[caseId][name] = createHash("sha256").update(data).digest("hex");
  }
}
writeFileSync(
  path.join(evidenceDir, "manifest.json"),
  `${JSON.stringify({ version: 1, cases }, null, 2)}\n`
);
console.log(`Wrote manifest for ${Object.keys(cases).length} cases.`);
