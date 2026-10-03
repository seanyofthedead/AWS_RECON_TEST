# Agentic Reconciliation Application Review

The app provides a useful demonstration of an analyst workspace, but its current accounting and workflow controls do not support operational reconciliation. Its strongest features are the separation of data providers, evidence navigation, case views, queue filters, and review actions. Its main weakness is that it presents simulated conclusions and generic journal suggestions with more certainty than the underlying checks support.

This review covers accounting logic, review and escalation workflows, fixture quality, dashboard definitions, persistence, integration boundaries, and proposed enhancements. It is a read-only review of the local working tree at `C:\Users\peder\Documents\AWS_recon_test`, performed October 3, 2026. HEAD was `9d13b61d18bde3558a169cad406c8e28cc16ecc3`; the tree already contained modified and untracked files, including the API adapter. Findings apply to that working tree, not necessarily the deployed Amplify build. Opening the deployed app through the browser tool timed out. Live authentication, backend enforcement, deployed asset access, PDF contents, and visual behavior were not verified. No repository files were changed. All review artifacts and build outputs are outside the repository.

## Evidence and validation

TypeScript checking passed with `tsc --noEmit --incremental false`. Vite's production build also passed, with output directed to the external review folder; it reported an outdated Browserslist dataset. These checks establish type and build health, not accounting correctness. A separate harness bundled the actual provider and rules with esbuild, substituted an in-memory localStorage and local fixture fetches, and exercised the existing code. It did not change the user's browser state. Raw results are in `audit-results.json`; reproduction code is in `audit.mjs`.

The baseline contains 88 transactions: 41 open, 20 escalated, 14 reviewed, and 13 resolved. There are 100 canonical rows and 12 import rows. All three CSVs parsed without errors, and corresponding baseline amounts, monetary variances, and AI reasons agree between UI and canonical files. All 352 baseline evidence paths exist locally; existence does not establish that PDF contents support the displayed claims.

The match evaluator produces 71 passes, six failures, and 11 inconclusive results. All 71 passing cases still have nonzero monetary variances. Every canonical row has identical PO, receipt, and GL amount fields. There are no zero or negative baseline monetary variances. Thirty-seven canonical rows have negative quantity differences and positive monetary differences; these are different dimensions, so opposite signs alone are not an accounting error. The app needs an explicit definition connecting quantity, price, and monetary discrepancies.

## Accounting findings

### F01 Critical Closure does not establish financial resolution

`src/pages/CasePage.tsx:62`, `src/pages/InboxPage.tsx:93`, `src/pages/EscalationsPage.tsx:49`, and `src/api/MockDataProvider.ts:948` map acceptance or escalation closure directly to RESOLVED. There is no posting operation, ledger acknowledgment, or subsequent balance reconciliation in the DataProvider interface. The general Accept button only checks whether a mutation is pending; conflicts and failed matches do not block it. The quick-accept path considers confidence and conflicts but not the match result.

Reproduction: CASE-00015 accepted an empty rationale and no evidence, became RESOLVED, and retained its $214.64 variance. Treat approval, execution, and verified resolution as distinct events. Permit closure only after a confirmed correction and recomputation, or a separately approved disposition such as a documented tolerable difference. Preserve the original variance while recording residual variance and disposition.

### F02 High The three way match is a reference check

`src/utils/threeWayMatch.ts:48` checks invoice-to-PO, receipt-to-PO, and GL-to-invoice strings. It does not compare amounts, quantities, unit prices, currency, vendor identity, receipt existence, duplicate invoices, or period. Missing invoice PO reference falls back to the PO's own number, making one check self-confirming. The model contains amount fields, but the evaluator ignores them.

Reproduction: matching references with PO amount 100, receipt amount 1, GL amount 999, and no receipt or GL document ID returns PASS. Rename the present result to Reference links match, and add separate line-level economic and documentary checks. Missing required evidence must remain inconclusive. A quantity or price discrepancy should have an explained tolerance result rather than a generic pass.

### F03 High Journal direction depends on an undefined variance sign

`src/utils/recommendations.ts:187` takes the entire variance as the adjustment amount and reverses all debit and credit accounts whenever variance is negative. The app describes variance as the difference between expected and actual without consistently defining which is subtracted from which. Journal direction must follow the original posted entry and desired corrected entry, not a generic sign rule.

Reproduction: a duplicate transaction with variance -100 produces Dr Expense / Cr Accounts Payable, although its recommendation says Reverse duplicate charge. Under a scenario where actual expense exceeds expected expense by 100 and variance means expected minus actual, this increases the overstatement. Define signed variance by dimension and compute correction lines from original versus corrected accounting. Test debit and credit originals, credit memos, reversals, and paid versus unpaid duplicates.

### F04 High Operational fixes are presented as accounting entries

`src/utils/recommendations.ts:273` and the subsequent templates prescribe Dr Suspense / Cr AP for stale master data, wrong PO, wrong vendor, reference mapping, and failed batch interfaces. Updating metadata or replaying an interface does not by itself establish a new payable. Replaying a batch and separately posting a template adjustment could duplicate recognition. The missing-receipt template assumes receipt of goods and suggests a GL entry before that fact is established.

Separate corrective actions into metadata correction, source-system repair, additional evidence, duplicate handling, and accounting adjustment. Require evidence of economic impact before proposing a journal. A failed interface should first determine which records posted, then replay only missing records with an idempotency key.

### F05 High Conversion errors are assumed to be foreign exchange

`src/utils/recommendations.ts:381` assigns conversion errors to FX Gain/Loss against AP. Canonical commentary includes conversion-factor or decimal-shift problems, and the dataset contains units of measure. Those causes do not necessarily involve currency. Require a typed conversion domain: UoM, currency, decimal scale, or another transform. Suggest an FX entry only with transaction currency, functional currency, rates, rate dates, and a verified valuation basis.

### F06 High Entries lack the accounting dimensions needed for a federal use case

`src/types/recommendation.ts` and `src/types/transaction.ts` contain generic account names, amount, and calendar period. They omit validated account IDs, entity or ledger, fund or Treasury Account Symbol, relevant accounting attributes, currency, source journal ID, budgetary/proprietary treatment, approval authority, and period availability. These entries are not ready to post merely because two lines balance.

`src/components/RecommendationCard.tsx` labels them Posting-ready entry. Use Illustrative adjustment until a finance-approved accounting profile validates the full entry. For a FEMA deployment, map the actual agency chart of accounts to USSGL and validate required dimensions and applicable budgetary treatment; do not assume every reconciliation requires the same paired entries. Treasury's [USSGL guidance](https://fiscal.treasury.gov/ussgl/index.html) supplies the federal reference framework, not the agency-specific posting configuration.

### F07 Medium Posting period and reversal are only suggestions

`src/utils/recommendations.ts:64` derives the period from the transaction posting date. Timing adjustments copy that date even when the issue concerns another service or close period. There is no open-period lookup, approval for prior-period treatment, scheduled reversal object, or reversal completion check. Model service period, posting period, adjustment effective date, fiscal year, and reversal linkage separately. Never silently backdate a correction to a closed period.

### F08 Medium Materiality rules are inconsistent and incomplete

`src/api/MockDataProvider.ts:839` flags positive variances above 500 and assigns higher severity above 800; negative variances would miss those magnitude checks. `src/pages/ExecutiveSummaryPage.tsx:128` uses absolute variance divided by amount and treats a zero denominator as zero percent. Thus a zero-amount case with a nonzero difference is Within policy. Structured comparisons use yet another signed threshold of 300 and label even zero differences warning.

Use a single versioned policy engine with absolute and percentage thresholds, denominator rules, transaction type, and explicit exclusions. Missing or zero bases should produce a documented exception rather than assumed compliance. The dashboard slider should be labeled a scenario threshold unless it actually selects an approved policy.

## Workflow and control findings

### F09 High Imported escalations are lost on reload

`src/api/MockDataProvider.ts:655` rehydrates imported records with forced open status and reviewed false, overriding saved decisions. Reproduction: imported CASE-00002 changes from Escalated to SCREENED_UNRESOLVED in a fresh provider with the same stored decisions. Closure happens to survive because resolvedAt later forces resolved status, so this is not a claim that all imported decisions disappear. Rehydrate source rows first and apply the complete decision history afterward. Persist original import timestamps rather than regenerating them during reload.

### F10 High Recommendation caching can freeze an incorrect zero entry

`src/utils/recommendations.ts:466` caches by case ID only. `src/pages/CasePage.tsx:48` requests recommendations before case-list data necessarily arrives. Calling the rules without a transaction generates a high-confidence zero-dollar missing-accrual entry. Supplying a duplicate transaction with a 123 variance afterward returns that same cached zero entry.

Do not generate recommendations before required inputs are available. Include source version, policy version, provider, and accounting profile in the cache key. Invalidate after source corrections. Loading and unsupported cases must produce no journal rather than a fabricated default liability.

### F11 High Link verification reports success without verification

`src/api/MockDataProvider.ts:997` returns true for any nonempty IDs, including nonexistent case, claim, and evidence IDs. `src/components/ClaimsPanel.tsx:75` ignores the returned ok field and displays Link Verified after any successful HTTP response, including `{ok:false}`. Opening a document also triggers this apparent verification.

Separate Document opened, Document exists, Reference relationship validated, and Claim supported. Validate IDs and relationships; handle false results and failed document fetches explicitly. A verification record should identify the claim, evidence version, method, verifier, and time. Current UI state is keyed only by evidence ID, not by the claim-evidence relationship.

### F12 High Review records cannot serve as an authoritative audit trail

`src/api/MockDataProvider.ts:534` stores decisions in browser localStorage and records reviewer as UI Analyst. Recommendation proposals and escalation attachments are also localStorage data. Another user or browser cannot rely on those records, and reset deletes them. Sign-out removes the authentication user but leaves demo decision data. Concurrent tabs can overwrite histories through read-modify-write updates.

For a pilot, use server-side append-only decision events, authenticated actor identity, case version checks, tenant separation, evidence version references, and policy versions. Add prepare/approve separation according to the actual delegated authority. GAO's [Green Book](https://www.gao.gov/greenbook) is the relevant federal internal-control framework; this review is not a formal compliance determination.

### F13 Medium Review actions lack a consistent state machine

`src/pages/CasePage.tsx:226` exposes Accept, Override, and Escalate regardless of current case status. `src/api/MockDataProvider.ts:966` changes status without clearing old resolution timestamps when reopening or escalating. Reproduction: an escalated case retains a resolvedAt date from its previous closure. REQUEST_MORE_EVIDENCE becomes open, with no distinct waiting state, recipient, due date, or evidence task. `OverrideModal` allows decision changes but cannot revise the proposed journal or root cause, and does not reset form state for every new case/open cycle.

Define allowed transitions and reject invalid ones at the provider boundary. Track prior closures as history, while current resolution fields reflect current state. Add Waiting for evidence, Evidence received, Proposed, Approved, Posting pending, Posted, Verified resolved, and Reopened as appropriate. Override should state what assertion or adjustment changed and preserve the previous version.

### F14 Medium Escalation workflow is incomplete

`src/pages/CasePage.tsx:204` Add to Escalation only stores a recommendation attachment; it does not escalate the case. Proposal is similarly only a local marker. `src/api/MockDataProvider.ts:1100` fabricates priority and packet activity from hashes rather than risk and actual review events. There is no real owner assignment, service-level clock, request delivery, or checklist completion control. Closing an escalation needs no checklist completion or evidence.

Make Add to Escalation one explicit operation that creates the queue item and attaches a recommendation snapshot. Build priority from financial exposure, age, close deadline, evidence gaps, and control risk. Add ownership, due dates, reassignment, evidence tasks, and a complete decision timeline. Analyst A through D are hashed display assignments, not actual staffing records.

### F15 Medium Import failure can leave the interface stuck

`src/pages/ExecutiveSummaryPage.tsx:330` sets isImporting then awaits the provider without catch/finally. A network or provider failure can leave Importing active indefinitely with no retry feedback. Only batch 1 is selected and supported. `BatchImportWorkflow` animates ERP connection, matching, and control validation after the import has already completed; these steps are not observations of actual processing.

Handle failures and partial imports explicitly, restore the button state, and show an import receipt with file or source ID, accepted/rejected counts, control totals, and idempotency status. In the demo, label the animation as a simulation. For integration, drive it from real backend events and show only completed operations.

## Data and reporting findings

### F16 High Fixture evidence is constructed from the diagnosis

`src/api/MockDataProvider.ts:415` synthesizes missing references and creates mismatch patterns from root-cause labels. It reads canonical PO/invoice IDs but initializes receipt and GL links itself rather than using the provided receipt and GL relationships. Wrong vendor is simulated through an invoice ID mismatch, rather than a vendor comparison. Consequently, the apparent evidence corroborates a preselected diagnosis by construction.

`src/api/MockDataProvider.ts:815` asserts receipt and GL documents are available even for missing-receipt cases. Claims, confidence, evidence weights, conflict flags, posting windows, run activity, and packet content contain seeded simulated values. Those are acceptable fixtures when identified clearly. They do not validate detection accuracy or agent execution. Generate findings from independent raw records and use expected diagnosis only as test truth.

### F17 Medium Multiple identifiers and variance meanings need explicit lineage

The canonical CSV has capitalized realistic IDs and lowercase placeholder IDs, plus quantity Variance and dollar Variance_Amount. The provider remaps source transaction IDs into different display IDs and vendor placeholders into real company names. `src/api/MockDataProvider.ts:593` resolves colliding normalized headers with special-case preference rules. Consumers can mistake the transformed display ID for the actual source-system ID or confuse quantity with money.

Keep immutable source IDs, display aliases, canonical join IDs, and document IDs in separate typed fields. Record each transformation and identify vendor names as synthetic. Distinguish quantity delta, price delta, monetary delta, UoM, and currency; avoid a universal Variance field for different dimensions. Validate cross-file relationships rather than accepting implicit preference rules.

### F18 Medium Ingestion silently repairs or drops invalid data

`src/api/MockDataProvider.ts:60` turns invalid amounts into zero. `parseCsv` at line 510 ignores HTTP status and parser errors. Missing posting dates become current timestamps. Dedupe at line 478 silently retains the first row and discards conflicting duplicates. Canonical duplicate IDs similarly retain the first record, with warnings only in development. Fixed ID ranges exclude records outside the 100-case fixture scheme.

Use schema validation, required-field checks, decimal or integer-minor-unit money, date and confidence bounds, referential integrity, and quarantine. Produce a row-level rejection report and reconcile source counts and monetary totals with accepted, rejected, and duplicate rows. A duplicate transaction is an exception to investigate, not necessarily a row to drop.

### F19 Medium Fixture coverage is too narrow for accounting assurance

There are no negative or zero baseline monetary variances. All 100 canonical PO, receipt, and GL amount fields equal one another despite independent nonzero monetary variances. Missing invoice PO reference occurs in every canonical row, yet the match path synthesizes or substitutes it. Baseline data contains predetermined confidence and reason values.

Add independent scenarios for over/understatement, credit memos, paid/unpaid duplicates, partial receipts, multiple receipts per invoice, split invoice lines, service invoices without POs, returns, cancellations, tax/freight, multi-currency, UoM changes, zero base, rounding, rejected batches, late postings, closed periods, reopened cases, and conflicting evidence. Include expected journal or explicit no-journal outcomes approved by an accounting owner. Measure false matches and false resolutions, not just UI completion.

### F20 Medium Dashboard completion and resolution measures overstate certainty

`src/pages/ExecutiveSummaryPage.tsx:150` counts Reviewed, Resolved, and Escalated as processed, then labels that percentage completed. Escalation represents unresolved work, and reviewed is not necessarily approved or posted. `src/api/MockDataProvider.ts:228` promotes a hashed subset of reviewed fixture records to resolved and generates closure dates. Thirteen baseline resolved cases therefore do not represent demonstrated corrective outcomes. `src/pages/ResolvedCasesPage.tsx` infers resolution type from a boolean rather than an actual disposition record.

Show Screened, Reviewed, Awaiting action, Approved, Posted, and Verified resolved separately. Add gross open dollar exposure, residual variance, age, stale evidence, SLA breaches, reopen rate, posting failure rate, and backlog trend. Label counts derived from synthetic outcomes as fixture metrics. Keep scenario tolerance distinct from policy compliance and include policy provenance.

## Integration and maintainability findings

### F21 High Provider switching can reuse data from another provider

`src/store/env.ts` defaults to mock even when an API URL exists, contrary to CLAUDE.md's described behavior. `App.tsx:54` prefetches using shared query keys, and pages use keys such as cases and case/id without provider identity. Switching providers does not explicitly clear those caches. With a five-minute stale time, mock data can remain visible after API selection; a subsequent action can call the selected API while the analyst is viewing cached fixture data.

Namespace queries and recommendations by provider and tenant, clear or invalidate on selection, and require an explicit environment indicator. Disable provider switching during pending decisions. Select the default intentionally from configuration and keep documentation consistent.

### F22 High API authentication and backend controls are unverified

`src/api/apiClient.ts:17` adds Content-Type but does not attach a Cognito access token. It does not explicitly include credentials for a cross-origin API. Therefore the current frontend does not demonstrate authenticated bearer-token requests; a same-origin cookie service could have another mechanism. API response values are cast to TypeScript types without runtime validation. No backend implementation is present in the examined app.

Verify the real service contract, authentication mechanism, authorization, idempotency, case version checks, audit retention, and response schemas before enabling operational mode. Bind the user identity to server decisions rather than accepting a browser-supplied reviewer. Authentication wrapping React routes alone does not prove that static CSV/PDF assets are access-controlled. Check deployed asset protection before substituting sensitive data; current local fixtures do not establish a live disclosure.

### F23 Medium Evidence regeneration does not match the app contract

`scripts/generate-demo-evidence.mjs:380` generates contract, invoice-log, and policy filenames with E1/E2/E3 prefixes. `src/utils/evidenceResolver.ts:22` expects Invoice.pdf, Purchase_Order.pdf, Receipt.pdf, and GL_Posting.pdf under ordinal case folders. The package generator defaults to 30 cases. Existing required baseline files are present, but the documented clean generation command cannot be assumed to recreate the current evidence set.

Use one versioned evidence manifest and one generator that satisfies it. Validate every referenced file, case/document identifier, and amount; label synthetic PDFs. Add a clean-room generation check outside the source checkout.

### F24 Medium Accounting behavior has no maintained regression suite

package.json and CLAUDE.md expose no test runner or lint workflow. TypeScript can validate types but does not detect the reproduced false passes, stale recommendations, status rehydration, or journal-direction issues. Add a small suite around independently approved accounting scenarios, plus provider contract and lifecycle tests. Keep demo fixture assertions distinct from production-control tests.

## Improvements and enhancements

| Priority | Improvement | Useful behavior and acceptance condition |
| --- | --- | --- |
| First | Honest demo semantics | Reference matching, simulated activity, illustrative adjustments, and fixture metrics are labeled locally. No opened PDF is called verified automatically. |
| First | Correct persistence and cache behavior | Imported escalations survive reload; late-loaded data replaces pending recommendations; provider switches never display another provider's cases. |
| First | Unified decision and policy controls | Every action applies the same eligibility rules. Missing evidence, zero denominators, and closed periods receive explicit dispositions. |
| Next | Independent reconciliation engine | Compare invoice/PO/receipt lines and ledger postings with many-to-many allocation, UoM conversion, currency, tolerances, and source provenance. |
| Next | Accounting profile and adjustment simulator | Finance-approved account mappings calculate original-versus-corrected entries, preview ledger effects, validate dimensions, and separate no-journal fixes. |
| Next | Full resolution lifecycle | Proposal, approval, posting acknowledgment, recomputation, residual variance, reversal follow-up, and closure each have evidence and actor identity. |
| Next | Evidence workbench | Side-by-side source documents and extracted fields with page/line citations, missing-field flags, document hashes, and extraction versions. |
| Next | Operational queues | Assign work to real users, prioritize by exposure and deadline, track evidence requests and due dates, and show aging and blocked cases. |
| Later | Agent investigation with bounded actions | An agent proposes hypotheses, retrieves approved sources, compares conflicting evidence, and records actual tool results. Accounting posting remains controlled by deterministic policy and approvals. |
| Later | Root cause prevention | Link related cases to shared mapping or interface defects; simulate the effect of fixing one source issue; replay only affected records. |
| Later | Analyst learning loop | Capture reasons for rejected or edited proposals, use an adjudicated evaluation set, and measure precision, false closure, reopen rate, and actual reviewer time. |
| Later | Close management and monitoring | Group cases by fiscal period/fund/source, show close blockers and reversal obligations, detect recurrence, and alert owners to policy or data drift. |

A strong product direction is a workspace that explains exactly what disagrees, what evidence supports the diagnosis, what action changes the accounting, and how the system proves the difference cleared. An agent can help gather evidence and propose hypotheses, but should not infer success from a button click or a prewritten run log.

## Required acceptance checks

1. Matching IDs with mismatched economic fields cannot yield an unqualified financial match. Missing invoice PO reference, receipt, or ledger posting remains inconclusive when required.
2. The same closure prerequisites apply from Inbox, Case Review, Override, and Escalations. Approval alone never creates a verified resolved outcome.
3. Every root-cause template has approved positive, negative, zero, missing-input, paid/unpaid, and closed-period scenarios. Metadata repairs produce no journal unless economic impact is proven.
4. Initial loading creates no zero-dollar default entry. Changing transaction or policy version recomputes the recommendation.
5. Imported closure, escalation, override, and evidence-request states survive reload; reopened cases show correct current fields and retain previous events in history.
6. A provider switch produces fresh provider-specific cases and recommendations, and actions cannot target cases shown from another environment.
7. Invalid IDs, `{ok:false}`, unavailable documents, and changed evidence versions never show a verified claim.
8. Malformed numeric fields, missing dates, duplicate IDs, CSV parse errors, and HTTP failures produce explicit import exceptions and reconciled totals.
9. Simultaneous reviews require a case version and do not silently overwrite each other. Authenticated prepare/approve permissions are enforced by the service.
10. Posting retries are idempotent. Failed or partial postings remain open, ledger acknowledgment is linked, and residual differences are recalculated before closure.
11. An independent evidence regeneration run recreates all manifest paths and verifies document content consistency.
12. Dashboard completion excludes unresolved escalations; exposure and verified outcomes reconcile to case detail and ledger evidence.

## Delivery recommendation

Keep the current app for demonstrations after correcting its misleading success labels and persistence bugs. Treat operational pilot readiness as pending until accounting scenarios, authoritative decision storage, authenticated integration, and the verified resolution lifecycle pass the checks above. Agency accounting policy, actual system-of-record interfaces, and deployment permissions require direct confirmation from their owners; this code review does not establish those facts.
