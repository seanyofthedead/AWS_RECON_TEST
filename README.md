# Agentic Reconciliation MVP

React + TypeScript + Vite front-end for a mock reconciliation workflow.

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5175`.

## Data

CSV files in `public/data` are read in-browser using Papaparse. No backend is required.

## Routes

- `/inbox` inbox queue
- `/cases/:caseId` case workspace
- `/escalations` human review queue
- `/settings` provider toggle (mock only)
