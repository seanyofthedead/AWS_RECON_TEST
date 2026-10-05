# Internal Demo Script — Agentic Reconciliation

**Audience:** Internal — engineers, PMs, GTM teammates who have never seen the tool
**Runtime:** ~8–10 minutes at a natural pace
**Demo URL:** https://staging.d30lp656izv8a2.amplifyapp.com/ (AWS Amplify deployment — this is what you'll demo from, not localhost)

*Italic lines in parentheses are stage directions — what to click or point to. Do not read them aloud.*

**Pre-demo checklist (do this before anyone is watching):**

1. *Open https://staging.d30lp656izv8a2.amplifyapp.com/ in a fresh browser tab or incognito window.*
2. *Sign in via Cognito with your demo credentials.*
3. *Click **Settings** in the top navigation.*
4. *Confirm **Data provider** is set to **Mock provider (in-browser CSV)**.*
5. *Click **Reset demo state** and confirm. The app reloads with ~88 baseline cases. Some fixture cases start out already resolved — note the Resolved count.*
6. *Click **Executive Summary** in the top navigation — your starting screen.*
7. *Set browser zoom (Ctrl/Cmd + or –) so the KPI cards and charts fill the shared screen.*

---

## Framing (read once, then go to the app)

This is a decision workspace for transaction reconciliation. The idea: an AI agent ingests transactions, pulls the supporting documents — invoice, purchase order, receipt, ledger entry — checks whether they agree, scores its confidence, and routes each case. High-confidence matches get a guided close: the reviewer confirms a reason, a rationale and the supporting evidence. Low-confidence cases land in front of a reviewer with everything already assembled, including an illustrative adjusting entry for finance to validate, and the reviewer closes, overrides, or escalates. The point is to keep the judgment with a person while removing the assembly work.

---

## Step 1 — Executive Summary: the workload at a glance

*(Screen: **Executive Summary** at `/executive`. Do not click yet — let the page settle.)*

- **Say:** "Top of the page is the KPI strip — total cases, open, reviewed, escalated, resolved. Resolved shows [read the number] — fixture cases that start out resolved after a reset."

*(Point to the KPI cards across the top of the page.)*

- **Say:** "This control sets the variance tolerance — the policy threshold. Changing it instantly recalculates how many cases breach."

*(Point to the variance threshold control and the banner directly beneath the KPI cards.)*

- **Say:** "Below: status distribution, root-cause rollup, and largest variances ranked. The workload arrives pre-triaged by risk and dollar exposure."

*(Scroll slowly down the page to bring the status distribution chart, root-cause rollup, and top-variances table into view.)*

- **Notice:** KPI cards are real numbers from the loaded CSV; the variance slider updates the banner count with no page reload.

---

## Step 2 — Inbox: close a high-confidence case live

*(Click **Inbox** in the top navigation.)*

- **Say:** "This is the working queue. Each row is one case — vendor, amount, variance, the system's explanation, and a recommended next step."

*(Point to the green banner above the case table.)*

- **Say:** "The green banner is the AI saying 'these are ready to close right now, I've checked the documents.' Right now it's flagging [read the number from the banner] high-confidence cases."

*(Click the **High confidence open** quick-focus button to filter the table.)*

- **Say:** "Let me focus on those. Every row here has a recommendation already prepared."

*(Pick the top row. Click **Review to close** on that row. The case page opens with the decision form already set to "Close as resolved".)*

- **Say:** "Closing needs a reason, a rationale and supporting evidence, and it records who decided. Posting to the actual ledger is a separate, controlled step — the AI prepares, a person commits."

*(Type a rationale of at least 15 characters, e.g. "Invoice, PO and receipt agree." Tick at least one evidence document. Click **Submit decision**. A success message appears.)*

- **Say:** "Done. A case that used to take fifteen minutes is closed in a minute, with a full audit record."

*(Click **Inbox** in the breadcrumb at the top of the case page. The closed case is no longer in the queue.)*

- **Say:** "Back in the queue, that case is gone."

- **Notice:** The form blocks submission until the rationale and evidence requirements are met; a failed three-way match also blocks closing.

---

## Step 3 — Resolved ledger: where closed cases land

*(Click **Resolved** in the top navigation.)*

- **Say:** "Alongside the fixture cases that were already resolved, here's the one we just closed: vendor, resolution, confidence, timestamp."

*(Point to the table rows — specifically the case just closed.)*

- **Say:** "Searchable by vendor, transaction, or case ID, with a last-seven-days filter. Every row links back to its evidence — nothing closes in the dark."

- **Notice:** State persists across navigation. In mock mode that's localStorage in your browser; in API mode it's the backend.

---

## Step 4 — Inside a hard case: the workspace

*(Paste `https://staging.d30lp656izv8a2.amplifyapp.com/cases/CASE-00092` into the address bar and press Enter. Or, navigate from the Inbox and click into the same case.)*

- **Say:** "This is a single case workspace — the whole story on one screen."

*(Point to the **Recommended Fix** card at the top of the page.)*

- **Say:** "Top card: the system's recommendation, its reasoning, its confidence."

*(Point to the **Illustrative adjustment (not posting-ready)** table directly below the recommendation.)*

- **Say:** "An illustrative adjusting entry — debit, credit, amount — labeled 'not posting-ready.' It's a proposal for finance to validate, not an action."

*(Point to the Status card and the low match-confidence value.)*

- **Say:** "Status card shows low match confidence. The system is honest when it isn't sure — that honesty is the feature, not a bug."

*(Click the **Evidence** tab in the tab bar.)*

- **Say:** "Evidence tab: source documents lined up for a three-way match."

*(Click the **Conflicts** tab.)*

- **Say:** "Conflicts tab: exactly what doesn't line up, called out explicitly."

*(Point to the **Close case**, **Override**, and **Escalate** buttons at the top of the page — do not click them.)*

- **Say:** "Three actions: Close, Override, Escalate. Decision and path are both recorded."

- **Notice:** Recommendation, evidence, and conflicts are all on one screen — no tab-hopping to chase paperwork.

---

## Step 5 — Escalations: senior reviewer packet

*(Click **Escalations** in the top navigation.)*

- **Say:** "When a case needs senior review, it lands here as a complete packet."

*(Click **Open Packet** on the first escalation in the list. The packet panel opens.)*

- **Say:** "Variance summary, likely root cause, recommended fix, what's already been tried — and a checklist of what's still missing. The reviewer makes a defensible call without chasing anyone down."

*(Point to the "still missing" checklist inside the packet.)*

- **Notice:** That checklist is the part GTM should highlight — it's the reviewer's working list, not a status field.

---

## Step 6 — Batch import: the workload keeps coming

*(Click **Executive Summary** in the top navigation.)*

- **Say:** "Reconciliation never stops. Watch."

*(Click the **Import Next Batch** button in the top right of the page. An import dialog runs.)*

- **Say:** "This ingests the next batch, normalizes each record, and prepares a review packet for every one — automatically."

*(When the import dialog finishes, point at the KPI cards across the top.)*

- **Say:** "Total cases just jumped from ~88 to ~100. New cases arrive already triaged and scored. The workload scales; the manual effort doesn't."

- **Notice:** Backed by `ui_transactions_batch_1.csv` in mock mode; `ApiDataProvider` posts the same action to `/api/batch/import` once API mode is enabled.

---

## Step 7 — Settings & data providers (engineering aside)

*(Click **Settings** in the top navigation.)*

- **Say:** "Two providers behind the same `DataProvider` interface: a Mock provider that parses CSV in the browser, and an API provider that hits `/api/*`."

*(Point to the **Data provider** options on the Settings page. The API option is greyed out.)*

- **Say:** "The API provider is groundwork: the client and `/api/*` calls exist, but API mode is disabled in this build until there's a backend to serve it. Same screens, same workflow once it's on."

- **Notice:** Engineers often ask about auth (Cognito via OIDC) and state (Zustand for UI, TanStack Query for server). Mention both if pressed.

---

## Q&A prep — likely internal questions

**1. "Is any of this real, or is it all mocked?"**
> The UI is real and production-shaped — deployed on Amplify, served via Cognito sign-in. Data is mock today: CSVs in `public/data/` parsed in-browser via Papaparse. There's an `ApiDataProvider` written against `/api/*`, but API mode is disabled in Settings until a backend exists. Both providers implement the same `DataProvider` interface so they stay in sync.

**2. "What's the stack?"**
> React + TypeScript SPA, Vite, Tailwind 3, React Router v6, TanStack Query for data state, Zustand for UI state, react-oidc-context for Cognito auth. Hosted on AWS Amplify. No component library — everything is built on Tailwind.

**3. "Can I run this locally instead of hitting the Amplify URL?"**
> Yes — `npm install && npm run dev` runs on http://localhost:5175. You'll need the `VITE_COGNITO_*` env vars set (or the `_LOCAL` override variants) for sign-in. The demo itself runs against Amplify so the audience sees what'll ship.

**4. "Where is the AI actually happening?"**
> Not in this repo. The agent logic lives behind the API provider. Today the mock provider serves pre-scored cases from CSV so the UI is fully demoable without a backend. The recommendation card, confidence score, three-way-match, and conflicts all come from upstream scoring — this app is the decision workspace, not the model.

**5. "What's the next milestone we're driving toward?"**
> Wiring the live `ApiDataProvider` against a real backend for an end-to-end pilot — same screens, same workflow, real data. The work is connecting to the data source and validating against controls, not rebuilding the application layer.

---

## Reset for the next demo

1. *Click **Settings** in the top navigation.*
2. *Confirm **Data provider** is set to **Mock provider (in-browser CSV)**.*
3. *Click **Reset demo state** and confirm in the dialog.*
4. *The app reloads with the baseline ~88 cases and the fixture-resolved cases restored.*
5. *Click **Executive Summary** in the top navigation and hand off.*

If the next demoer wants a fully clean session (no cached sign-in), have them open the Amplify URL in a fresh incognito window instead.
