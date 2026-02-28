# Performance Baseline + Improvements

## Instrumentation (dev only)
- Route timing: `markRouteStart` on nav + `useRoutePerf` on page mount
- Data timing: CSV fetch/parse + transaction mapping
- Derived timing: Executive Summary aggregations + Inbox filters

## Baseline (2026-01-21)
Captured via `node scripts/perf-sample.mjs` (Node perf harness).

Slowest operations:
- parse canonical_variances.csv: 1418.63 ms
- parse ui_transactions.csv: 481.73 ms
- sort top variances: 50.74 ms
- map transactions: 33.08 ms
- executive metrics: 6.91 ms

Notes:
- Route timing instrumentation is enabled in DEV console for browser runs.

## Fixes Implemented
- Dev-only perf instrumentation (routes, data parse, derived metrics)
- Query cache warm-up via `staleTime` + `gcTime`
- Route-based code splitting with Suspense fallback
- Memoized presentational components to reduce rerenders
- Prefetch `cases` and `escalations` on app mount

## After (2026-01-21)
Captured via `node scripts/perf-sample.mjs` (Node perf harness).

Slowest operations:
- parse canonical_variances.csv: 1150.86 ms
- parse ui_transactions.csv: 217.46 ms
- sort top variances: 34.63 ms
- map transactions: 15.15 ms
- executive metrics: 3.34 ms

## Remaining Bottlenecks / Next Steps
- Capture DEV console route timings on real navigation.
