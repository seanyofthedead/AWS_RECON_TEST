# Agentic Reconciliation MVP

React + TypeScript + Vite front-end for a mock reconciliation workflow.

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5175`.

## Data

CSV files in `public/data` are read in-browser using Papaparse. No backend is required. Rows that fail validation are rejected, not repaired; the Settings page shows the load report.

## Evidence

Each case folder in `public/evidence` holds four synthetic PDFs: `Invoice.pdf`, `Purchase_Order.pdf`, `Receipt.pdf`, and `GL_Posting.pdf`. `public/evidence/manifest.json` lists them with SHA-256 hashes, and the tests check both the hashes and the documents' amounts against the CSVs. After replacing evidence files, run `npm run evidence:manifest` and `npm test`. The generator that produced these PDFs is not in this repository.

## Routes

- `/inbox` inbox queue
- `/cases/:caseId` case workspace
- `/escalations` human review queue
- `/settings` provider toggle (mock only)
