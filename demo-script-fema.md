# FEMA Executive Demo Script — Agentic Reconciliation

*Read aloud while screen-sharing. Target run time: **7 minutes** at a natural pace.*
*Italic lines in parentheses are stage directions — do not read them.*
*`[FILL IN]` / `[VERIFY ON SCREEN]` = glance at the screen and say the live number.*

### Timing budget

| Scene | Screen | Time |
|---|---|---|
| 0 — Hook | Executive Summary | 0:25 |
| 1 — Executive Summary | Executive Summary | 1:15 |
| 2 — Inbox + live resolve | Inbox | 1:35 |
| 3 — Resolved ledger | Resolved | 0:35 |
| 4 — Inside a hard case | Case workspace | 1:20 |
| 5 — Escalations | Escalations | 0:45 |
| 6 — Batch import | Executive Summary | 0:50 |
| 7 — Closing | Executive Summary | 0:25 |
| | **Total** | **~7:10** |

*Pacing note: ~130 words/minute. If you run long, the first cuts are the optional Settings aside in Scene 6 and the second resolve in Scene 2.*

---

## Pre-demo checklist (do this before anyone is watching)

1. *Open the app and sign in. Go to **Settings**.*
2. *Confirm the data provider is **Mock provider (in-browser CSV)**.*
3. *Click **Reset demo state**, confirm. The app reloads to the clean baseline. Some fixture cases start out already resolved — note the Resolved count so you can point to the change later.*
4. *Navigate to **Executive Summary** — your starting screen.*
5. *Set browser zoom so the KPI cards and charts are readable on the shared screen.*

---

## Scene 0 — Opening hook (~25 sec)

*(Screen: Executive Summary. Do not click yet.)*

> FEMA moves money fast — disaster-relief grants, contractor payments — often in the worst conditions. Every dollar still has to be reconciled: invoice, purchase order, receipt, and ledger entry all have to agree. Today that's manual — people in spreadsheets, one row at a time. It's slow, and it's hard to audit. We built this to change that. Let me show you, live.

---

## Scene 1 — The Executive Summary (~1 min 15 sec)

*(Screen: Executive Summary. Scroll slowly as you talk.)*

> This is the executive view — the entire reconciliation workload in one snapshot.

*(Point to the KPI cards across the top.)*

> Across the top: total cases under review — [VERIFY ON SCREEN: ~88] — and how many are open, reviewed, escalated, and resolved. Resolved is at [VERIFY ON SCREEN: the seeded count] — cases the sample data starts with. By the end of this demo, you'll watch that number move.

*(Point to the variance threshold control and the banner beneath the cards.)*

> This control sets the variance tolerance — your policy. The system instantly flags how many cases breach it: right now, [VERIFY ON SCREEN: ~23]. That's a policy question answered in one second.

*(Scroll to the charts — status distribution, root cause rollup, top variances.)*

> Below, it shows where the risk concentrates — by status, by root cause, and the largest dollar variances, ranked. The workload arrives already triaged by risk and exposure. An executive can walk in cold and, in thirty seconds, know where the money and the risk are.

---

## Scene 2 — The Inbox, and resolving cases live (~1 min 35 sec)

*(Click **Inbox** in the top navigation.)*

> This is the working queue — every case a reviewer could pick up. Each row is one transaction: vendor, amount, variance, the system's explanation for the mismatch, and a recommended next step.

*(Point to the green banner above the table.)*

> This banner flags [FILL IN: read the number in the green banner] high-confidence cases that can be closed right now — the AI checked the documents, found everything in agreement, and is confident enough to recommend closing.

*(Click the **High confidence open** quick-focus button.)*

> Let me focus on those. Every row here has a recommendation already prepared.

*(Pick the top row. Click **Review to close**. The case page opens with the decision form already showing "Close as resolved".)*

> I'll close this one. Notice what it asks for: a reason, a short rationale, and the evidence that supports closing. It records who decided, and posting stays a separate, controlled step. The AI prepares the case; a person stays in command of the books.

*(Type a short rationale — at least 15 characters, e.g. "Invoice, PO and receipt agree." Tick at least one evidence document. Click **Submit decision**. A success message appears.)*

> Done — a case that used to take a reviewer fifteen minutes, closed in a minute, with a full record.

*(Click **Inbox** in the breadcrumb at the top of the case page to return to the queue.)*

> Back in the queue, that case is gone. Every close is captured for audit.

---

## Scene 3 — The Resolved ledger (~35 sec)

*(Click **Resolved** in the top navigation.)*

> Here's where that case just landed. Alongside the cases that were already resolved, it now shows the one we just closed: vendor, how it was resolved, confidence, and a timestamp. This is the audit trail. For an organization answering to inspectors general, that matters — every closed case is searchable by vendor, transaction, or case ID, and every one links back to its evidence. Nothing is closed in the dark.

---

## Scene 4 — Inside a hard case (~1 min 20 sec)

> Not every case is easy — and that's where the real value is.

*(Open case **CASE-00092** — via the Inbox or the address bar at `/cases/CASE-00092`.)*

> This is a single case workspace — the whole story on one screen.

*(Point to the "Recommended Fix" card.)*

> At the top, the system's recommendation, its reasoning, and its confidence in that recommendation.

*(Point to the "Illustrative adjustment (not posting-ready)" table.)*

> It even sketches the adjusting entry — debit, credit, amount. But the label says "not posting-ready." It's a proposal for finance to validate, not an action.

*(Point to the Status card and the low match confidence.)*

> And look here — the match confidence is low. The system is telling you plainly, "I'm not sure about this one." That honesty is the feature.

*(Click through the **Evidence** and **Conflicts** tabs.)*

> Underneath, the reviewer has everything: the source documents with a three-way match across them, and a Conflicts tab spelling out exactly what doesn't line up.

*(Point to the Close case / Override / Escalate buttons.)*

> Three clear choices — close, override, or escalate. The system did the assembly and the analysis; the decision stays with a person, and every path is recorded.

---

## Scene 5 — Escalations (~45 sec)

*(Click **Escalations** in the top navigation.)*

> When a case needs senior review, it lands here — and it's a complete reviewer packet.

*(Click **Open Packet** on the first escalation in the list.)*

> The senior reviewer gets the variance summary, the likely root cause, the recommended fix, what the system already tried — and, just as important, what's still missing, as a checklist. They can make a defensible call without chasing paperwork. The hard cases get more attention, and experienced people spend their time on judgment, not assembly.

---

## Scene 6 — Scaling up: batch import (~50 sec)

*(Click **Executive Summary**. Point to the **Import Next Batch** button, top right.)*

> One more thing — reconciliation never stops; new transactions arrive constantly. Watch.

*(Click **Import Next Batch**. The import dialog runs.)*

> The system ingests the next batch, normalizes each record, and prepares a review packet for every one — automatically.

*(When the import finishes, point at the KPI cards.)*

> The dashboard updates: total cases just jumped from about 88 to 100. Every new case arrives already triaged, scored, and ready for a reviewer. The workload scales; the manual effort doesn't.

*(Optional — only if asked about deployment.)*

> Today this runs on self-contained sample data. The screens are built against a single data interface, so connecting them to your live financial systems means building that backend connection — the workflow you've seen stays the same.

---

## Scene 7 — Closing (~25 sec)

*(Click **Executive Summary**. Let the KPI cards fill the screen.)*

> So: intelligent triage by risk and dollar exposure. High-confidence cases closed in a minute with a full audit trail. Hard cases escalated with a complete packet. And a system honest enough to tell you when it isn't sure. For FEMA, that's faster reconciliation, stronger accountability for every relief dollar, and an audit trail that holds up. We're ready for a pilot whenever you are. I'll take your questions.

---

## "If asked" — Q&A appendix *(not read aloud)*

**1. "Does the AI actually post entries to our accounting system?"**
> No. The system *sketches* an adjusting entry and labels it "not posting-ready." A person always confirms, and the actual posting stays a separate, controlled step. The AI assembles and recommends; it never acts on the books on its own.

**2. "How do we know the AI isn't just wrong with confidence?"**
> Every recommendation carries an explicit confidence level, and low-confidence cases are routed to a human instead of being auto-closed — you saw that in the hard case. The system is built to say "I'm not sure" out loud, and every closed case links back to the underlying evidence.

**3. "What's the audit trail? Could we defend a closed case to an inspector general?"**
> Yes. Every resolved case records who decided it and when, and links to the invoice, purchase order, receipt, and ledger posting behind it. The Resolved view is searchable by vendor, transaction, or case ID, and can be narrowed to the last seven days.

**4. "Where does the data come from, and is it secure?"**
> Today's demo runs on self-contained sample data. In production, the same interface connects to your financial systems through a backend API, behind authenticated sign-in. That backend connection is the next build step — the workflow doesn't change.

**5. "What would a pilot look like, and how long to stand up?"**
> A pilot scopes to one transaction type and one program's data. The application layer is already built and the screens won't need to be rebuilt, so the work is connecting to your data sources and validating against your controls. [FILL IN: your specific pilot timeline and scope.]
