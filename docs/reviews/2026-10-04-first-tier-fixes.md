# First-tier fixes against the October 3 review

October 4, 2026. This applies the "First" priority row of [findings.md](2026-10-03/findings.md) (honest demo semantics, persistence and cache correctness, unified decision controls) to the committed source on `master` (`074d2b0`). The original findings are unchanged.

Scope: mock provider only, Cognito sign-in unchanged. The work was done in a fresh cloud checkout, not the Windows working tree. That tree's uncommitted API adapter and other local edits are not on GitHub, so they are not included here and may conflict with these files when merged.

## Status by finding

| Finding | Status | Change |
| --- | --- | --- |
| F01 Closure without financial resolution | Partially fixed | One rule set (`src/utils/closurePolicy.ts`) is enforced by the provider for all pages. Closing requires a rationale of at least 15 characters and evidence from the same case, and a failed match blocks it. A closure without a confirmed match is recorded as `DOCUMENTED_EXCEPTION` with the residual variance. There is still no posting or ledger acknowledgment step. |
| F02 Three-way match is a reference check | Fixed for the demo | References and amounts are reported separately. A missing invoice PO reference no longer confirms itself. A missing receipt or GL document is inconclusive. PO, receipt, and GL amounts are compared, and an unexplained monetary variance keeps the result inconclusive. |
| F03 Journal direction | Partially fixed | Duplicate reversal no longer flips with the variance sign. The variance sign convention still needs an accounting owner. |
| F04 Operational fixes as journals | Fixed | Master data, reference data, wrong PO, wrong vendor, batch interface, and missing receipt now propose no journal. |
| F05 Conversion error assumed FX | Fixed | No FX entry. The next steps ask for the conversion type first. |
| F06 Posting-ready label | Fixed (label) | Entries are labeled "Illustrative adjustment (not posting-ready)". Accounting dimensions are still absent. |
| F08 Materiality | Partially fixed | Conflicts use the absolute variance. A zero amount with a nonzero variance is a dashboard exception. The threshold is labeled a scenario threshold. There is no versioned policy engine yet. |
| F09 Imported escalations lost on reload | Fixed | Saved decisions override import defaults, and the import time is persisted. |
| F10 Recommendation cache | Fixed | No recommendation is produced before the transaction loads. The cache key includes the rules version and the transaction fields. |
| F11 Link verification | Fixed | The provider checks the case, the claim, the evidence, and that the claim cites the evidence. The UI honors `ok:false`, keys results by claim and evidence, and says the check confirms the reference, not the document's contents. |
| F13 State machine | Partially fixed | Invalid transitions are rejected (close when closed, escalate when escalated). Leaving the closed state clears the current resolution fields. The form resets on every open. There are no waiting or posting states yet. |
| F14 Escalation workflow | Partially fixed | "Escalate with this fix" escalates the case and attaches the recommendation only after the escalation succeeds. Closing an escalation goes through the same gate. Priority and analysts are still seeded and are labeled that way. |
| F15 Import stuck | Fixed | Import failures reset the button and show an error. The walkthrough is labeled as a simulation. |
| F16 Evidence built from the diagnosis | Fixed for match evidence | Match evidence now comes only from source rows (the canonical join IDs and the invoice row's PO reference). Claims, conflicts, and the run log are still seeded, and the run log is labeled simulated. |
| F20 Dashboard completion | Partially fixed | "Reviewed or closed" excludes escalations. The Resolved page shows the recorded disposition, and seeded closures are labeled "Seeded demo closure". |
| F21 Provider switching | Fixed for this build | Only the mock provider exists in committed source, so the API option is disabled and a saved `api` selection is reset to mock. Namespacing query keys by provider is still needed once an API adapter lands. |
| F24 No regression suite | Started | Vitest suite in `tests/` (`npm test`) covering acceptance checks 1, 2, 3 (in part), 4, 5, and 7. |
| F07, F12, F17 (in part), F18, F19, F22, F23 | Open | Not in the first tier. |

## Observable changes in the demo

- Fixture match results: all 88 baseline cases now show "Reference links: PASS · Amounts: INCONCLUSIVE". The fixture's PO, receipt, and GL amounts all equal the invoice amount, so they cannot explain any variance. Earlier PASS and FAIL results came from synthesized mismatches.
- The Inbox's one-click close is replaced by "Review to close", which opens the decision form on the case page.
- Committed source showed the header badge `USCG CIP · Demo`, and the deployed bundle shows `FEMA · DEMO`. Both labels were carried over by mistake with the Amplify and Cognito configuration borrowed from a separate Amplify app, so the badge has been removed from source. The deployed bundle still shows it until it is rebuilt. The mismatch is further evidence that committed source does not reproduce the deployed ZIP.

## Verification

- `npm run typecheck`: passes.
- `npm test`: 26 tests pass.
- `vite build`: passes.
- Browser smoke test on the local dev server (port 5175) with a locally injected OIDC session. No real Cognito sign-in was done. It covered the dashboard, Inbox, the case close flow (blockers, then a documented-exception closure), the claim reference check, closing an escalation, and Settings, with no page errors. The only console error was a missing `/favicon.ico`, which predates this work.
- `docs/reviews/2026-10-03/audit.mjs` now stops at its F01 step because the provider rejects an empty-rationale, no-evidence closure, which is the intended fix. The harness was left unchanged as a review artifact.
- Not verified: live Cognito sign-in with real credentials, the deployed Amplify app, and any backend.
