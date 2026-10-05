# Executive Demo Script — Agentic Reconciliation

*~5 minutes at a natural speaking pace. Pause briefly at each [SHOW] transition.*

---

## 1. Opening Hook (30 sec)

Every large company has a version of this problem. Thousands of invoices arrive each month, each one needs to be matched against a purchase order and a receipt before it can be posted. Today, that matching is mostly manual — analysts sit in spreadsheets, cross-referencing documents, eyeballing dollar amounts, flagging discrepancies one row at a time. It is slow, it is expensive, and the longer a variance sits unresolved, the harder it is to close the books on time. We built this to change that.

---

## 2. The "So What" (60 sec)

[SHOW: Executive Summary page with KPI cards and charts visible]

Think of this as an intelligent triage desk for your finance team. An AI agent ingests every transaction, pulls the invoice, the purchase order, and the receipt, checks whether the numbers line up, and assigns a confidence score — essentially telling your team "I am 92% sure this one is fine" or "this one has a problem and here is why." High-confidence matches can be closed in a minute, with the reviewer's rationale and evidence on record. The ones that need a human get routed to a reviewer with all the supporting documents already assembled. Instead of analysts spending their day hunting for paperwork, they spend it making decisions. The net effect: faster close cycles, fewer errors, and your most experienced people focused on the exceptions that actually require judgment.

---

## 3. Live Walkthrough (2 min)

**Moment 1 — The Dashboard**

[SHOW: Executive Summary page, scroll to show status distribution chart, root cause rollup, and top variances table]

This is the executive view. At a glance you can see how many cases are open, how many have been resolved, and where the risk concentrates — by vendor, by dollar amount, by root cause. Notice the variance threshold filter at the top: management can set the policy tolerance and immediately see which cases fall outside it. This is the kind of visibility that usually takes a week of analyst time to compile.

**Moment 2 — The Inbox**

[SHOW: Inbox page with the high-confidence open banner and case table visible]

Here is the working queue. Every row is a case, and the system has already done the heavy lifting — it shows the vendor, the dollar variance, the AI's best explanation for why the numbers don't match, and a recommended next step. See this green banner? It is telling us there are high-confidence cases ready to close right now. Open one, confirm the rationale and evidence, done. That is a case that used to take fifteen minutes of an analyst's day resolved in a minute.

**Moment 3 — The Case Workspace**

[SHOW: Case detail page for a specific case, with the recommendation card, evidence tab, and structured comparison visible]

When an analyst opens a case, they get the full story on one screen. At the top is the AI's recommendation — what to do and why, with a pre-drafted booking entry ready to copy into the ledger system. Below that are the source documents: invoice, purchase order, receipt, general ledger posting. The structured tab shows a side-by-side comparison — expected versus actual — with green and red indicators so mismatches are impossible to miss.

**Moment 4 — Escalations**

[SHOW: Escalations page with a reviewer packet open in the side panel]

Not every case is straightforward. When the system or an analyst flags something that needs senior review, it lands here with a full packet: what was tried, what evidence was found, what is still missing, and suggested next actions. The reviewer has everything they need to make a call without chasing anyone down.

---

## 4. Architecture at a Glance (60 sec)

[SHOW: Settings page showing the data provider options]

Here is how it fits together in plain terms. Transaction data flows in from your financial systems. An AI screening layer matches each transaction against its supporting documents and scores the result. Those scored cases land in this workspace, where your team reviews, resolves, or escalates them. Decisions are tracked, so you have a full audit trail of who closed what and when. The system is designed to sit alongside your existing ledger — it prepares the posting entry, but your team controls the final approval. Today we are running against sample data. The screens are built against a single data interface, and the client for a live backend is already written, so the path from pilot to production is connecting that backend, not rebuilding the workflow.

---

## 5. Closing + Vision (30 sec)

[SHOW: Executive Summary page, zoomed to the KPI cards]

What you have seen today is the first layer: intelligent triage that compresses days of reconciliation work into hours. The next step is closing the loop — connecting directly to the general ledger so approved entries post automatically, and expanding to cover additional transaction types beyond three-way match. The foundation is here, the workflow is proven, and the team that has to close the books each month will feel the difference immediately. We are ready to move into a pilot whenever you are.
