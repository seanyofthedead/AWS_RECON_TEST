# Client demo review and invoice-intake PoC scope

Source: Otter.ai export of the client demo held October 5, 2026 (`Note_20261005_1400_otter.ai.txt`, about 41 minutes). Prepared October 6, 2026. This is an analysis document; no application code was written.

## How to read this document

- **Timestamps** are the start of the Otter segment that contains the quote (m:ss). Long segments hold several sentences, so a quote may appear some time after its timestamp.
- **Quotes are verbatim from the export**, including transcription errors. Where a word is clearly misheard, the likely meaning is given in brackets and marked as an interpretation. "File on Q", "File and Queue", "filing queue", "file loan Q", "Phyllom Q" and "file queue" are all read as **FileOnQ**. Outside quotes, people's names use the meeting invite's spellings (Traci, Laurie); inside quotes they keep the transcript's spellings (Tracy, Lori).
- **Speaker labels are unreliable.** Otter labelled most segments "Unknown", and its numbered labels drift: one label sometimes covers two people, and one person sometimes gets two labels. Each attribution below is based on what the speaker says or on someone addressing them by name. Every attribution carries one of three tags: *(named)* means someone addresses the speaker by name or the speaker introduces themselves; *(by content)* means the speaker is inferred with reasonable confidence; *(uncertain)* is used otherwise.
- **Stated** means the client said it in the meeting. **Inferred** means it is our reading and needs confirmation.
- **Three kinds of capability are kept apart:**
  - **Demo behavior** is what the reconciliation demo shown on Oct 5 does.
  - **Real capability** is what exists today.
  - **Proposed capability** is what we would build.

### Who was in the room (attribution key)

Names and spellings come from the meeting invite (To and Cc lines), which supersedes the transcript's spellings. Roles are not on the invite; they come from the transcript and are marked stated or inferred.

| Person | Side | Role as stated or inferred | Basis |
|---|---|---|---|
| Sean Pedersen | Guidehouse | Presenter, built the demo | *(named)*, self-introduction at 6:16 (Speaker 8) |
| Felice Fava | Guidehouse | Opened the meeting and set the agenda | *(named)*: "thanks for all that, Felice" (6:16) |
| Melanie Geesaman | Contractor (marked CTR on the invite); Guidehouse side (inferred) | Kicked off ("the team is excited to share some of the tools") | *(named)* at 1:39. "Melody" at 2:13 is probably her |
| Gina Oliva | Contractor (marked CTR on the invite); Guidehouse side (inferred) | Attendee | *(named)* at 2:34, introduced by a Guidehouse speaker ("We've got Gina here, myself") |
| Speaker 11 | Guidehouse (inferred) | Said the FEMA S/4HANA work went live "on Thursday" | *(uncertain)*: Felice, Gina or Melanie |
| Traci Billings (transcribed "Tracy") | ICE | Owns AP intake (inferred). Asked the intake questions | *(by content)*. Laurie says "as Tracy was saying" (25:02); David says "getting Tracy and the team some relief" (35:57) |
| Laurie Nadeau (transcribed "Lori Nadu", "Lori", "Lauren") | ICE | "chief of staff here at OFM", "built the original invoice consolidation process 20 years ago" (24:23) | *(named)*, Speaker 12 |
| David Dalenberg | ICE | Senior leader. Co-decides with Beth (inferred) | *(named)*: "David, did you have a question?" (30:06); then Speaker 13 |
| Beth Baden | ICE | Co-decides with David. Contact for the budget-intelligence follow-up | *(named)* at 39:38 and 39:46 |
| Shilonda Holmes (transcribed "Shalanda") | ICE (inferred) | On the invite, out of office. Role unknown | 1:01 |
| Cathaleen Winter | ICE (inferred) | Cc'd on the invite. Not mentioned in the transcript; attendance and role unknown | Invite only |
| Holly, "Mr. Bovich" (spelling unverified) | Department level (inferred) | Separate meeting in about two weeks | Mentioned at 37:58; not on the invite |
| Ramatu, Rolf | ICE (inferred) | Possible attendees of the budget-intelligence session | 40:30; not on the invite |

The invite also went to the ICE CFO scheduling mailbox. The transcript has at least 14 distinct Otter labels for about 9 speakers, which confirms the labels split and merge people.

**The client is ICE's Office of the CFO**, as the invite shows. "AIDS OCFO" at 1:45 is a mis-transcription of "ICE OCFO". "OFM" (24:23) is an office within it, and "DHS has some interest in improving this for the entire department" (37:36) refers to ICE's parent department. FEMA is mentioned as a separate Guidehouse engagement (22:54), not as the client.

---

## 1. Executive summary

- **The client asked for invoice intake automation, not reconciliation.** The demo showed three-way-match reconciliation. Traci redirected immediately: "our biggest hurdle right now isn't so much in actually resolving and paying the invoices than it is the actual intake in getting the invoices ready for payment" (16:50).
- **Laurie named a specific "quick win":** read vendor PDFs from the shared mailbox, fill the FileOnQ data fields, check validity, report a confidence level ("98% a valid invoice"), then "create that record in the file on Q system. Maybe even pass through that PDF … for attachment" (25:02).
- **Earlier automation failed because vendor layouts vary:** "other RPA efforts or other intelligence efforts really struggles because the invoices are so very different from vendor to vendor" (28:05). On the existing bots, David said they "helped a little bit, but not enough" (36:41).
- **The goal is less labor and less rework.** David said they should "go from the need of having 30 people down to maybe two or three" (31:23), and that records go through "345, hands doing nothing but quality check reviews" (36:20; read as 3 to 5).
- **A human stays in the loop.** "I don't think we'll ever get away from having to have a human in the loop at intake" (David, 31:23).
- **There are longer-horizon ideas, but they are not this PoC:** a move to SAP S/4HANA "moving away from" FileOnQ (22:23), and possibly bypassing FileOnQ to go "straight into our paying system, right? FFMS or … straight to the treasury" (31:23).
- **The next step is paperwork, then a prototype.** David asked for a "project plan, concept of ops, you know, all the normal kind of grassroots stuff, and then a bill" (38:53) so that "Beth and I can sit down, review it, and figure out if, when, and how" (34:58). Scope was narrowed to AP: "let's take a smaller bite at the apple, work and focus in on the AP stuff" (38:53).

---

## 2. Current-state process (AP invoice intake)

| # | Step | Source | Status |
|---|---|---|---|
| 1 | Vendors email invoices as attachments to a **shared mailbox**. | "we get invoices through a shared mailbox as attachments from wherever they're coming from" (Traci *(by content)*, 17:15) | Stated |
| 1a | The attachments are mostly PDFs. | "those PDFs that are coming in through the vendor for the invoices" (Laurie, 24:58) | Stated for PDFs. The share of scanned images versus digital PDFs is unknown |
| 2 | **Technicians** check the mailbox every day. | "the technicians have to vet that mailbox every day" (Traci *(by content)*, 17:29) | Stated |
| 3 | Each item is reviewed for the **required data elements** of a proper invoice. | "review it to make sure that it has all of the various data elements to establish a proper invoice" (17:29) | Stated. The checklist itself was not given (see §10) |
| 4 | The technician creates a **FileOnQ record** and fills specific data fields. | "they are creating a file in File on Q, which is what we use as our data repository as well as our workflow for invoices up until the certification and payment from Treasury" (17:29); "creating those records, filling out specific data fields, checking to see if it's a valid invoice" (Laurie, 25:02) | Stated |
| 4a | The invoice PDF is stored with the FileOnQ record. | Laurie proposes to "pass through that PDF … for attachment" (25:02). FileOnQ is called the "data repository" (17:29) | **Inferred** that technicians attach PDFs manually today |
| 5 | Improper invoices are **rejected**. | "We can reject an invoice." (19:47, *(uncertain)*, probably Traci) | Stated that rejection exists. **How** (email to vendor, timing, who) was not described |
| 6 | **Quality-check reviews** repeat 3 to 5 times per record. | "The same kind of record goes through 345, hands doing nothing but quality check reviews." (David, 36:20) | Stated. "3 to 5" is our reading of "345". **Where** in the flow the reviews happen is not stated |
| 7 | Once the invoice is established as proper, it goes **to the field for approval**: the contracting officer's representative (COR) or another responsible person does receiving and acceptance. | "once we pass all of those markers to establish a proper invoice, and we know what we're paying. Then it goes out to the field for them to do the approvals on their end from like the contracting officer, representative, or whoever is responsible for providing, receiving, and acceptance" (19:51) | Stated |
| 7a | Field routing runs through FileOnQ's workflow. | FileOnQ is "our workflow for invoices up until the certification and payment" (17:29) | **Inferred** |
| 8 | The record comes back through FileOnQ and **interfaces to the financial system** for payment. | "then it comes back through File and Queue to interface to our financial system to be paid" (20:20) | Stated |
| 8a | The financial system is **FFMS**. | "go straight into our paying system, right? FFMS" (David, 31:23) | Stated, but it is a single mention and could be mis-transcribed. Confirm |
| 9 | **Certification** and **Treasury payment**. | "up until the certification and payment from Treasury" (17:29) | Stated. Who certifies, and through which Treasury system, was not described |
| — | Existing **bots/RPA** cover parts of the process. | "because of the bots that OFM has created" (Guidehouse speaker, 26:14); "bots helped a little bit, but not enough" (David, 36:41) | Stated that bots exist. **What** they automate is unknown |

**Not stated in the meeting:** invoice volume, number of vendors, current staffing per step, cycle times, error or rejection rates, and the FileOnQ field list. The "1000s of invoices arrive each month" at 6:16 is from Sean's generic pitch, not client data. David's "30 people" (31:23) is the only staffing figure. It is **inferred** to be the intake workforce, but he did not say so explicitly.

---

## 3. Pain points and goals

| Pain point or goal | Supporting quote | Time | Speaker |
|---|---|---|---|
| **Intake is the bottleneck**, not resolution or payment | "our biggest hurdle right now isn't so much in actually resolving and paying the invoices than it is the actual intake in getting the invoices ready for payment" | 16:50 | Traci *(by content)* |
| | "digging through that bail box [mailbox] and getting items into file loan Q [FileOnQ] is our biggest hurdle area right now with accounts payable" | 17:29 | Traci *(by content)* |
| | "We're just getting crushed on invoice intake." / "It's killing us." | 35:57 / 36:10 | David / *(uncertain)* |
| **Record creation and data entry into FileOnQ** | "one of the biggest hurdles that we have is … the intake into filing queue, creating those records, filling out specific data fields, checking to see if it's a valid invoice" | 25:02 | Laurie |
| **Vendor format variety breaks RPA and bots** | "every single vendor has their own way of presenting an invoice … other RPA efforts or other intelligence efforts really struggles because the invoices are so very different from vendor to vendor" | 28:05 | *(uncertain)*: Traci or Laurie. David replies "So Tracy, Lori" |
| | "the bot stuff had to be not perfect, but pretty close in order to work" | 30:09 | David |
| | "bots helped a little bit, but not enough" | 36:41 | David |
| **Rework from 3 to 5 quality reviews per record** | "we shoot ourselves in the head by working, reworking, and working again. The same kind of record goes through 345, hands doing nothing but quality check reviews." | 36:20 | David |
| | "in some cases, I think we're spending $1 to save a nickel. I'd like to get that turned around." | 36:20 | David |
| **Staffing goal: about 30 people down to 2 or 3** | "we should be able to go from the need of having 30 people down to maybe two or three, right? That could do this workload if it's done correctly." | 31:23 | David |
| **Human in the loop stays** | "I don't think we'll ever get away from having to have a human in the loop at intake" | 30:49–31:23 | David |
| **Possibly bypass or eliminate FileOnQ** | "maybe we can get to the position where we can bypass or completely eliminate file on queue. If we're actually doing intake right, we might not have to have an aggregator up front. We can go straight into our paying system, right? FFMS or … straight to the treasury … as well as a cost reduction on licensing." | 31:23 | David |
| **SAP S/4HANA transition** | "thinking ahead to SAP S/4HANA and moving away from the Phyllom Q [FileOnQ] software program … how this could potentially work with SAP to help us flow the information from receipt to payment" | 22:23 | *(uncertain)*: a client speaker who said "I'm not an IT person"; possibly Traci |
| **Fit with the current process** | "does it sit on top of what we're already doing?" | 16:40 | Traci *(by content)* |
| **Wants a measurable prototype** | "we've got to get some prototypes up and actually get it to the point where it's learning" / "At the first instance of running this, what can we expect for the accuracy rates?" | 32:06 | *(uncertain)*: labelled Speaker 14, but continuous with David's remarks |
| **Willing to commit SME labor** | "maybe it's going to take some labor. So I know we're going to get some pushback there, some subject matter expertise labor." | 34:32 | David |
| **Focus on AP rather than audit/PBC** | "I would rather focus my efforts on AP at the moment because it's just weighing me down." | 37:36 | *(uncertain)*: a client speaker "from an audit perspective" |

**Expectations to manage:** David framed the solution as "fuzzy logic, continual learning" that "gets better and better and better, just like a human would" (30:49, 36:41), and Sean agreed (30:46). This is one of the four corrections in §7. The PoC should show a measurable improvement process, not self-learning.

---

## 4. Stakeholders

| Stakeholder | Role | Concerns raised | What they need to see to say yes | Decision role |
|---|---|---|---|---|
| **Traci** *(by content)* | AP intake owner (inferred) | Where the data comes from (16:30). Whether it sits on top of current work (16:40). Fit to intake rather than reconciliation (17:03). "if this is really setting us down that right path to help automate that piece of the pie" (18:14) | Her own kinds of invoices, taken from a mailbox, landing as correct FileOnQ-ready records, with less technician effort and fewer QC passes (inferred) | Co-owns prototype design with Laurie: "I'll leave it to Tracy and and Lori and the team to kind of figure out … who needs to do what when it comes to prototyping" (38:53) |
| **Laurie** | OFM chief of staff; designed the original invoice consolidation process (24:23) | Whether we can build an interface that creates or updates records (24:40). Validity checks with a confidence level (25:02) | The quick win from 25:02: PDF in, fields filled, validity confidence, FileOnQ record created with the PDF attached | Process authority and co-owner of prototyping (38:53). David: "She can design it better again" (36:41) |
| **David** | Senior leader (inferred) | Vendor variety and the limits of bots (30:09). Labor and rework (36:20). FileOnQ licensing cost (31:23). Accuracy at first run (32:06, *(uncertain)*) | A project plan, CONOPS and "a bill" (38:53). A credible labor-reduction story. An honest accuracy answer | **Decides with Beth**: "so Beth and I can sit down, review it, and figure out if, when, and how" (34:58) |
| **Beth** | Senior leader (inferred) | "we definitely need help" (39:46) | Same package as David (inferred) | **Co-decider** (34:58). Also the contact for a separate budget-intelligence session (40:00) |
| **CIO organization** | Not present | Named by Sean as the gate for all connections (18:22, 20:25) | Security documentation, the data-flow design, the hosting environment, and the AI service authorizations (inferred) | **Approval gate** for any connection to the mailbox, FileOnQ or financial systems |
| **AP technicians** | Process users today; likely reviewers in the PoC | Not present | A review screen that is faster than manual entry (inferred) | Users and SME labor (34:32) |
| **CORs / field approvers** | Downstream receiving and acceptance (19:51) | Not present | Unchanged handoff, or better data at handoff (inferred) | Out of PoC scope |
| **Holly, Mr. Bovich** | Department level (inferred from 38:26: "that's up at the department level") | How this works with "fiber" (37:58; unclear term) and whether to offer it to components (38:41) | Unknown | Possible department-wide sponsors. Not decision-makers for this AP PoC |
| **Unidentified "audit perspective" speaker** (37:36) | ICE, possibly audit or internal controls. Could be David, Beth or Cathaleen Winter if she attended *(uncertain)* | Prefers to focus on AP now | — | Influencer |
| **Shilonda Holmes, Cathaleen Winter** | ICE (inferred). On the invite (Cathaleen on Cc), roles unknown. Shilonda was out of office (1:01) | None recorded | Unknown | Keep them on the follow-up distribution. Confirm roles (§10) |

---

## 5. Requirements for the PoC

Priority: **Must** (the PoC fails without it), **Should** (expected, can be thinned), **Could** (if time allows). The **Basis** column shows the transcript evidence. "Inferred" rows are our proposals and are not client-stated.

### 5.1 Functional

| ID | Requirement | Priority | Basis |
|---|---|---|---|
| F1 | **Ingest from a mailbox.** Pick up new emails, pull out PDF attachments, and keep the link between each email and its attachments. PoC: a test mailbox or a simulated drop folder, never the client's mailbox. | Must | 17:15, 25:02 |
| F2 | **Classify attachments** as invoice or not (statements, past-due notices, supporting documents) and split multi-invoice PDFs. | Should | Inferred. Shared mailboxes typically mix document types |
| F3 | **Extract the invoice fields from varied vendor layouts** without per-vendor templates. | Must | 28:05, 30:09 |
| F4 | **Confidence per field and per invoice.** Each field gets a score and a pointer to where it was found (page, region). The invoice gets an overall status (Ready / Needs review / Reject candidate). | Must | Laurie: "98% a valid invoice" (25:02) |
| F5 | **Validity checks against the required data elements** using a client-supplied checklist, plus arithmetic checks (line items add up to the total) and format checks. Each failed check has a reason. | Must | 17:29, 25:02 |
| F6 | **Human review queue.** The PDF appears beside the extracted fields. The reviewer can correct, approve or reject, and each action is recorded. | Must | 31:23 ("human in the loop"), 26:14 |
| F7 | **Create a FileOnQ record with the PDF attached** through a mock FileOnQ adapter in the PoC. The record is created only after reviewer approval. | Must (mock) | 25:02 |
| F8 | **Reject invalid invoices** with coded reasons and a drafted vendor notice that lists the missing elements. Nothing is sent in the PoC. | Must (reason codes); Should (draft notice) | 19:47 |
| F9 | **Duplicate detection** (same vendor, invoice number and amount, or the same file seen twice). | Should | Inferred |
| F10 | **Capture corrections** as labeled data with before and after values, for accuracy measurement and later improvement. | Should | Supports 30:49 honestly; see §7 item 3 |
| F11 | **Metrics view**: throughput, auto-validated share, review time, and field accuracy against ground truth. | Should | Supports 32:06 and 38:53 |
| F12 | **Reference-data lookups** (vendor master, contract or order number) on synthetic tables. | Could | Inferred. Depends on the client checklist |
| F13 | **Visible processing trace** per invoice: steps actually executed, not scripted ones. | Could | 26:14 ("you could watch it in real time") |

### 5.2 Non-functional

| ID | Requirement | Priority | Basis |
|---|---|---|---|
| N1 | **Human in the loop.** No record goes to FileOnQ (mock) without reviewer approval. Any later "auto-validate" path needs measured accuracy and a client-approved threshold. | Must | 31:23 |
| N2 | **Auditability.** A server-side, append-only event log records ingestion, extraction output, each edit (old and new value), and each decision with user and time. It must not be resettable from the browser. | Must | Fixes demo gap (§7 item 1) |
| N3 | **Accuracy measurement.** A held-out, ground-truth-labeled test set and repeatable scoring per field, per layout, and for seen versus unseen layouts. | Must | 32:06 |
| N4 | **Data handling.** The PoC uses synthetic data only, with no PII, no real tax IDs or bank details, and no client system access. | Must | Inferred. CIO gate at 18:22 |
| N5 | **Security posture documented for CIO review**: data flow, hosting, identity, model and service list, and component inventory. | Should (PoC); Must (pilot) | 18:22, 20:25 |
| N6 | **Deployable to an authorized environment.** Use FedRAMP-authorized services only, behind adapters so the hosting choice can change. | Should | Inferred. See §9 |
| N7 | **Configurable rules and thresholds** (required elements, confidence cutoffs) without code changes. | Should | Inferred |
| N8 | **Explainability.** Every extracted value can be traced to its location in the source document. | Should | Inferred. Supports reviewer speed and trust |
| N9 | **Accessibility (Section 508)** of the reviewer UI. | Could (PoC); Must (pilot) | Inferred. Federal requirement |
| N10 | **Integration boundary.** One adapter interface for the "system of record", so FileOnQ, S/4HANA or the financial system can be swapped later. | Should | 22:23, 31:23 |

---

## 6. Explicit asks and commitments

| # | Ask or commitment | Who | Time | Status / note |
|---|---|---|---|---|
| 1 | **Project plan** | Asked by David | 34:58, 38:53 | Owed by us, to be pulled together "between you [Tracy] and Sean or Felice" (34:58) |
| 2 | **Concept of operations** | Asked by David | 38:53 | Owed by us |
| 3 | **Cost estimate**: "and then a bill. You know, what do we have to resource" | Asked by David | 38:53 | Owed by us. Covers our cost and the client resources needed |
| 4 | **Prototype**: "we've got to get some prototypes up" | Client-side *(uncertain; likely David)* | 32:06 | Expected. Who does what is to be decided with Traci and Laurie (38:53) |
| 5 | **Client SME labor** for prototyping | David acknowledged it | 34:32 | Client commitment-in-principle; "pushback" expected |
| 6 | **COE-style prioritization exercise** (as done at FEMA) | Offered by Guidehouse *(uncertain; likely Felice)* | 35:08 | Optional. The client scoped to AP only for now (38:53) |
| 7 | **Share the slides** after the discussion | Promised by Felice | 2:49 | Owed by us. Check the slides for the same accuracy issues before sending |
| 8 | **Meeting with Holly and Mr. Bovich "in about two weeks"** on how this works with "fiber" | Guidehouse speaker *(uncertain)* | 37:58 | Around Oct 19, 2026. "Fiber" is unidentified. The client said "I don't think fiber works with anything" (38:19). Clarify the term |
| 9 | **Separate budget-intelligence conversation** with Beth; Beth and David may bring Ramatu and Rolf | Offered by Guidehouse; Beth agreed | 40:00, 40:30 | To schedule. Out of PoC scope |
| 10 | **About 10 minutes with Traci on "a couple other contracts"** after the call | *(uncertain)* | 38:53 | Out of scope; listed for completeness |
| 11 | **Claims Sean made that read as commitments**: connect to "any system" (18:22); mailbox and FileOnQ "very easily spin up" (25:42); "learns as it goes" (30:46); "designed specifically to work with … S4hana" (23:09) | Sean | as noted | Reframe these in the follow-up note (§7) and the plan |
| 12 | Deferred: PBC management orchestrator demo | Offered | 2:49, 37:12 | Not taken up |

---

## 7. Claims to correct

### 7.1 The four known issues (facts)

| # | What was said | Time | Fact |
|---|---|---|---|
| 1 | "this is an immutable audit log" (Resolved page) | 9:00 | Decisions live only in browser storage and can be reset. There is no server-side audit trail. The code confirms this: `localStorage` in `src/api/MockDataProvider.ts` and `src/utils/resetDemoState.ts` |
| 2 | "open source … regularly updated and vetted by our colleagues over at DOD because they they wrote it" | 20:25 | The tool was not written or vetted by DoD. It uses common open-source libraries (React, Vite and others) |
| 3 | Agreed it "learns as it goes" and raised "Reinforcement learning" | 30:46, 32:31 | There is no model. Confidence scores and reasons come from the demo CSV (`Confidence`, `AI_Reason` columns), and some values and agent steps are generated by a seeded random function in `MockDataProvider.ts` |
| 4 | Mailbox and FileOnQ monitoring is "something we can very easily spin up" | 25:42 | Neither integration exists. FileOnQ's interface options are unknown |

### 7.2 Other statements worth checking before the plan goes out

These were not on your list. They are not necessarily wrong, but each could set an expectation the PoC cannot meet. You decide whether to address them.

- **"You're not buying anything new. All of what you see is open source, which means it's free"** (20:25). Hosting, AI or OCR service usage, ATO work and labor all cost money. The bill (§12) will show this anyway.
- **"it can connect to any system"** (18:22). This is true only in the sense that an integration can be built where an interface exists and the CIO approves it.
- **"it was designed specifically to work with the systems such as S4hana"** (23:09). The demo reads CSV files and has no SAP connector.
- **Auditors "would be given access"** (9:00). The demo has Cognito sign-in but no auditor role or access model.
- **"Train the agent on" historical vendor invoices** (28:35). This is a plausible proposed capability, but it depends on the data and approach (§9). It is not a current feature.
- **Demo branding and vendor names.** The deployed demo header reads "FEMA · DEMO" (per `docs/session-handoff-2026-10-04.md`). Change it before showing the demo to this client again. Also confirm which build was shown on Oct 5. Builds before commit `42dcf8b` (Oct 5) displayed real federal-contractor names beside exceptions, and the "your usual suspects … quite a bit of variances" remark (9:00) would read badly if those names were on screen.

### 7.3 Draft follow-up note

> **Subject:** Thank you, and a few clarifications ahead of the AP intake plan
>
> Traci, Laurie, David and Beth,
>
> Thank you for the time on Monday and for the candid feedback. It sharpened our focus: the problem worth solving first is invoice intake, meaning getting invoices from the shared mailbox into FileOnQ as complete, valid records, with less rework along the way.
>
> Before we send the project plan, concept of operations and estimate, I want to tighten four things I said during the demo, so the plan starts from an accurate baseline.
>
> 1. **Audit trail.** I called the Resolved page an immutable audit log. In the demo build, reviewer decisions are stored in the browser for presentation purposes and can be reset. For your environment we would keep a server-side, append-only record of every extraction, edit and approval, tied to the user, and the CONOPS will spell that out.
> 2. **Software provenance.** The demo is built on widely used open-source components, but it was not written or vetted by DoD. I misspoke. Anything we build for you would go through your CIO's security review, and the plan will list the components and services involved.
> 3. **Learning.** The demo does not contain a trained model. Its confidence scores, explanations and agent steps are illustrative. The improvement loop David described is achievable as a managed process: reviewer corrections become labeled data, we measure accuracy by field and by vendor, and we adjust the extraction and validation from those results. We'll build that measurement into the prototype rather than promise it in advance.
> 4. **Integrations.** Mailbox and FileOnQ connectors do not exist yet, and how quickly they can be built depends on the interfaces FileOnQ offers and on CIO approval. We propose a prototype that uses a test mailbox, synthetic invoices and a mock FileOnQ record, with a short discovery step on the real FileOnQ interface running alongside it.
>
> None of this changes the approach Laurie outlined: PDFs in from the mailbox, fields extracted and checked against the required data elements, a confidence level for each invoice, a technician approving or rejecting, and a FileOnQ record created with the PDF attached. It does mean the plan will show the actual accuracy on test invoices before anyone relies on it.
>
> To size the plan accurately, it would help to have a short conversation about monthly invoice volume, the number of vendors, the checklist your technicians use for a proper invoice, and a FileOnQ point of contact.
>
> Thank you again,
> Sean

---

## 8. PoC scope proposal

### 8.1 Smallest credible demo of Laurie's quick win

A single end-to-end flow on synthetic data:

1. **Email in.** About 30 to 50 synthetic emails land in a test mailbox or a simulated inbox folder. Some carry one invoice PDF, some carry several attachments, and some are not invoices.
2. **Ingest.** The system pulls the attachments, classifies each document, and splits multi-invoice PDFs.
3. **Extract.** Fields are read from each invoice: vendor, remit-to, invoice number and date, contract/order number, line items, totals, and the others on the client checklist.
4. **Validate.** Required-element and arithmetic checks run, with a pass or fail reason for each.
5. **Score.** Each field and each invoice gets a confidence score. Each invoice is routed as Ready, Needs review, or Reject candidate.
6. **Review.** A technician sees the PDF beside the fields, with the source location highlighted, and approves, corrects or rejects with a reason code.
7. **Record.** On approval, the mock FileOnQ adapter creates a record (fields plus attached PDF) and returns a record ID. On rejection, a vendor notice is drafted (not sent).
8. **Measure.** A metrics page compares results with ground truth and shows the server-side audit log for any invoice.

Out of scope for the PoC: COR approval, FFMS and Treasury interfaces, bypassing FileOnQ, S/4HANA, the client's real mailbox or data, and claims of autonomous learning.

### 8.2 What to build for real and what to simulate

| Component | PoC | Note |
|---|---|---|
| Mailbox ingestion | **Real code** against a test mailbox, **or** a simulated drop folder | Decision #3 in the final list. A test mailbox proves more but adds setup time |
| Document classification and splitting | **Real** | |
| Field extraction | **Real** | See §9 for options |
| Validation rules | **Real**, configurable | The checklist comes from the client. Until it arrives, use a draft based on FAR 32.905(b) and label it as a draft |
| Confidence scoring | **Real** and **measured** (calibration is checked against ground truth) | Never hard-coded or random |
| Review UI | **Real** | May reuse UI patterns from this repo: confidence pill, queue, escalation |
| Audit log | **Real**, server-side, append-only | |
| FileOnQ | **Simulated**: a mock service behind a real adapter interface | No guesses about the FileOnQ API; the mock defines *our* interface |
| Vendor rejection email | **Simulated** (draft only) | |
| Vendor master and contract lookups | **Simulated** (small synthetic tables) | Could |
| Identity | Existing Cognito sign-in (demo only) | Agency SSO comes at the pilot stage |
| COR approval, FFMS, Treasury, S/4HANA | **Not shown**, or shown as a static "next step" box clearly labeled future | |

### 8.3 Sample data

- **Vendors are fictional only.** Use names from Microsoft's published fictitious-company list, which this repo already uses (for example Contoso, Fabrikam, Northwind Traders, Tailspin Toys, Litware, Proseware, Fourth Coffee, Wide World Importers, Trey Research, Lucerne Publishing). Skip any name on that list that is now a real company. Run a quick name check before publishing.
- **8 to 12 distinct layouts**, varying field positions, labels ("Invoice No." / "Inv #" / "Bill Number"), date formats, and one-page versus multi-page line items. Include at least 2 or 3 layouts that are **held out** from all tuning, to test unseen vendors. This directly answers the RPA concern at 28:05.
- **Document-quality variants**: born-digital PDFs, scanned images (skewed, low resolution, stamped), and a phone-photo-style page.
- **Edge cases**:
  - a missing required element (no contract or order number, no remit-to, no invoice date)
  - line items that don't add up to the total
  - a duplicate invoice
  - a credit memo
  - several invoices in one PDF
  - an invoice plus supporting documents in one email
  - a non-invoice email (statement or past-due notice)
- **Identifiers are fake by construction.** Tax-ID-like and bank-like fields use obviously invalid patterns. No real PII.
- **Ground truth** is a JSON file per document with the correct value for every field and the expected validity outcome and reason. Target 100 to 200 documents in total, split into development and held-out test sets. These sizes are assumptions to revisit once client volumes are known.
- **Later phase, not the PoC:** a sample of real historical invoices with their keyed FileOnQ values as ground truth. This needs a data agreement and an approved environment (§10).

### 8.4 Success metrics

Set the targets with the client after Phase 0. We should not quote targets before measuring.

| Metric | Definition | Why |
|---|---|---|
| **Field-level accuracy** | Share of fields extracted exactly right after normalization, reported per field and for seen versus held-out layouts | Directly answers "what accuracy" (32:06) |
| **Auto-validated share** | Share of invoices routed "Ready" (all fields above threshold, all checks pass) | A proxy for the labor reduction (31:23) |
| **False-accept rate** (gating metric) | Share of "Ready" invoices that actually contain an error or are invalid | The metric that protects payments. It must be near zero before any straight-through processing is discussed |
| **Invalid-invoice detection** | Precision and recall of the reject-candidate flag against ground truth | Supports the rejection step (19:47) |
| **Confidence calibration** | Whether 90% confidence is right about 90% of the time | Makes the "98%" idea (25:02) meaningful |
| **Reviewer minutes per invoice** | Timed review sessions, compared with a manual-entry baseline measured with technicians | Supports the labor case. The baseline must come from the client |
| **Correction rate per field** | How often reviewers change each field | Shows where to improve. Becomes the honest "learning" signal |

---

## 9. Architecture options

The common shape for all options is below. "Real" and "mock" refer to the PoC.

```
 Shared mailbox ──► Ingest & classify ──► Extract ──► Validate (rules) ──► Score & route
 (test mailbox                                                                  │
  in PoC)                                                     ┌─────────────────┤
                                                              ▼                 ▼
                                                     Reject + draft notice   Review queue (human)
                                                                                │ approve
                                                                                ▼
                                                                   System-of-record adapter
                                                                   ├─ FileOnQ (today; mock in PoC)
                                                                   ├─ S/4HANA (future; unknown interface)
                                                                   └─ FFMS / Treasury (David's bypass idea; out of scope)
                         Server-side audit log ◄── every step above
```

Downstream steps stay as they are today: field approval by the COR → FileOnQ → financial system → certification → Treasury.

### Option A: OCR plus LLM extraction, with deterministic validation

- **How it works.** OCR produces text and layout. An LLM fills a fixed field schema and must cite the source text for each value. Values that don't appear in the OCR text are rejected (grounding). Rules run the validation. Confidence combines OCR confidence, agreement across repeated or alternative extractions, and rule outcomes.
- **Pros.** Handles new layouts without templates (28:05). Covers federal-specific fields such as contract or order numbers and line-item references through the schema. Fast to build.
- **Cons.**
  - LLM confidence is not calibrated out of the box and must be engineered and measured.
  - Hallucination risk is managed by grounding, not removed.
  - The model endpoint must be in an authorized environment for real data.
  - Per-page cost needs estimating.

### Option B: managed document-AI service with a prebuilt invoice model

- **How it works.** A cloud document-AI service with a prebuilt invoice or expense model returns fields, per-field confidence and bounding boxes. Examples include the invoice models from AWS, Microsoft Azure and Google Cloud. Our rules layer validates the output, and gaps can be filled with custom models or Option A.
- **Pros.** Native per-field confidence and locations. A mature OCR pipeline. Less to build.
- **Cons.**
  - Prebuilt schemas are commercial-invoice oriented and may miss federal elements.
  - Custom models need labeled data.
  - It ties the solution to one cloud provider.
  - FedRAMP status and region availability must be verified for the specific service.

### Option C: rules and LLM hybrid with vendor profiles

- **How it works.** Deterministic templates or rules handle the highest-volume vendors, and Option A or B handles the long tail. The router picks a path by recognized vendor.
- **Pros.** Highest precision and explainability for high-volume vendors. Cheapest per page for those vendors.
- **Cons.** Template upkeep is exactly where RPA failed (28:05). The option is only worth it if a few vendors make up most of the volume, which is unknown (§10).

### Recommendation for the PoC

Build extraction behind one interface. Benchmark **Option A** against **Option B** on the same synthetic set, using the §8.4 metrics, and keep validation deterministic in both. Add Option C only if Phase 0 shows that volume is concentrated in a few vendors. The final choice will likely depend on which cloud and AI services the client's CIO has already authorized (§10).

### Where FileOnQ and S/4HANA fit

- **FileOnQ.** In the PoC it is a mock behind a system-of-record adapter. Unknowns:
  - API availability
  - batch import formats
  - attachment handling
  - required fields
  - test environment
  - licensing terms on integration
  - whether the existing OFM bots already write to FileOnQ, and how

  These are **questions for the client** (§10), not assumptions.
- **S/4HANA.** It is the likely future system of record (22:23). The adapter boundary keeps the intake components reusable when FileOnQ is replaced. Ask whether the S/4HANA program already includes an invoice-capture component, to avoid duplicating it. That is a common pattern in S/4HANA programs, but it is unverified for this client.
- **Bypassing FileOnQ** (31:23). FileOnQ currently provides the workflow, including field approval routing (19:51) and certification (17:29). Bypassing it means replacing that workflow, not just intake. Treat it as a later decision informed by the S/4HANA roadmap.

### FedRAMP and authority to operate (ATO)

- **PoC.** Synthetic data in a contractor sandbox. Confirm with the CIO that this needs no ATO. The current demo runs on commercial AWS in us-east-1 with Cognito. That is acceptable for synthetic data only.
- **Pilot or production.** All cloud services, including OCR, document AI and LLM endpoints, must be FedRAMP-authorized at the client's required impact level. The impact level is likely Moderate, but that is inferred and must be confirmed. The system will need an agency ATO, or must inherit and extend one. Invoices contain tax IDs and banking details, so expect PII and sensitive financial-data controls.
- **AI governance.** Expect the agency's AI-use policy and current federal AI guidance to apply: use-case inventory, human oversight, and testing documentation. Confirm which versions apply.
- **Records.** The audit log and invoice images fall under records-retention schedules. Confirm the retention period.

---

## 10. Open questions for the client

### Data
1. What is the monthly invoice volume, including peaks such as fiscal year-end?
2. How many active vendors are there, and what share of volume comes from the top 10 or 20?
3. What share of invoices are born-digital PDFs versus scans, and how often does one email carry several invoices or supporting documents?
4. Is there a history of invoices with correct field values (FileOnQ records with attached PDFs) that could serve as ground truth? Under what data-use terms and in what environment?
5. What are current rejection rates, error rates found in the 3 to 5 QC reviews, and baseline minutes per invoice?
6. Which data fields do technicians key into FileOnQ today?

### Systems and IT
7. What is the shared mailbox platform, and what access methods are permitted for an automated reader?
8. FileOnQ: which version, where is it hosted, and what interface options exist (API, bulk import, file drop, UI automation)? Is there a test environment, and who administers it?
9. What do the existing OFM bots automate, on what platform, and do they write to FileOnQ?
10. How does FileOnQ interface to the financial system? Is it FFMS? (Confirm the name.)
11. What is the S/4HANA timeline? Will S/4HANA replace FileOnQ's workflow, and does the program include invoice capture?
12. Which cloud environments and AI/OCR services are already authorized, and at what impact level?
13. What is the CIO approval path: sandbox rules, ISSO contact, ATO expectations for a prototype versus a pilot?
14. What identity provider should the review UI use at pilot?
15. What was "fiber" (37:58)?

*Stakeholder check (not numbered):* what roles do Shilonda Holmes and Cathaleen Winter have in AP intake or approval, and should they review the plan?

### Process
16. What is the exact checklist for a "proper invoice" that technicians use today?
17. What is the rejection workflow: who notifies the vendor, how, and on what timeline? Does the 7-day notice rule for improper invoices under the Prompt Payment rules apply as the client applies it?
18. What does each of the 3 to 5 QC reviews check, and which could a validated extraction replace?
19. What data must be captured at intake for field routing to the COR?
20. Who would act as PoC reviewers, and how much SME time can be committed (34:32)?
21. What counts as "valid enough" to create a record? Who sets the confidence thresholds?

### Policy
22. Which required elements apply: FAR 32.905(b) and 5 CFR 1315.9 proper-invoice elements, plus any agency-specific or contract-specific additions?
23. Does any agency policy restrict automated creation of records in FileOnQ or a financial system, or require a named human approver?
24. Agency AI-use policy: does this need an AI use-case inventory entry or a review board?
25. What are the records-retention requirements for invoice images and the audit log?
26. Workforce change management: how should labor-reduction goals (31:23) be framed and communicated?
27. What contract vehicle and funding source is expected for the prototype? (Context: "under 10%" at 38:26 is unclear.)

---

## 11. Risks and assumptions

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Credibility from the four overclaims** if the client discovers them first | High | Send the §7.3 note before or with the plan |
| **Expectation of self-learning and 30 → 2–3 staff** (30:49, 31:23) | High | Present labor savings as a measured outcome of the pilot, not a promise. Show the false-accept rate and reviewer minutes instead |
| **FileOnQ integration is infeasible or slow** (no API, licensing limits) | High | Use the adapter boundary and a mock in the PoC. Make FileOnQ discovery a Phase 0 task. Fallbacks are bulk import or the existing bots |
| **ATO timeline** dominates pilot schedule | High | Prefer already-authorized services. Engage the ISSO in Phase 0 |
| **Accuracy below expectations** on scans or unseen layouts | Medium | Use held-out layouts in the PoC. Report per-field results. Route low confidence to review |
| **Confidence miscalibration**: high confidence on wrong values | High | Calibration testing plus grounding. False-accept rate is the gating metric |
| **SME availability** (David expected "pushback", 34:32) | Medium | Keep SME asks small and scheduled: checklist, sample review, timed sessions |
| **S/4HANA makes FileOnQ work throwaway** | Medium | Keep integration thin. Intake components stay system-agnostic |
| **Scope creep**: PBC, budget intelligence, department-level rollout, FileOnQ bypass | Medium | Hold the PoC to §8.1. Track the rest separately |
| **Demo artifacts misrepresent the product** (FEMA label, simulated agent steps) | Medium | Rebrand. Label simulated elements in any future demo |
| **Workforce sensitivity** around headcount goals | Medium | Use client-led messaging. Frame as capacity and rework reduction |

### Assumptions (to confirm)

- The PoC uses only synthetic data and needs no ATO. (The client, ICE OCFO, is now confirmed from the invite.)
- Invoices arrive mostly as PDFs. A meaningful share are scans.
- FAR 32.905(b) is a reasonable draft checklist until the client provides theirs.
- Client SMEs can give a few hours a week during the PoC.

### Answering "what accuracy at first run?" honestly

The question at 32:06 deserves a straight answer. We **cannot** quote an accuracy for their invoices before measuring on them, and we should say so. What we **can** commit to:

1. **Measure before relying on it.** The PoC reports field-level accuracy on held-out invoices, including vendor layouts the system has never seen, before anyone uses its output.
2. **Expect results to vary.** Accuracy will differ by field and by document quality. Clean digital PDFs and standard fields (invoice number, date, total) typically do better than scans and fields such as contract line items. The report will show that breakdown rather than one headline number.
3. **Gate on safety, not averages.** Nothing goes into FileOnQ without a reviewer until measured accuracy for that field, and possibly that vendor, meets a threshold the client sets. The false-accept rate is the gating number.
4. **Improve through a managed process.** Reviewer corrections are captured and used to adjust prompts, rules or models, and the gain is re-measured. It is a controlled process, not autonomous learning.

---

## 12. Inputs for the project plan, CONOPS and estimate

### Phases

Durations are ranges. They assume a core team of 3 or 4, synthetic data in the PoC, client SMEs at about 2 to 4 hours a week, and no client system access before the pilot.

| Phase | Scope | Duration (range) | Exit criteria | Key dependencies |
|---|---|---|---|---|
| **0. Discovery** | Checklist, volumes, FileOnQ interface discovery, CIO/ISSO intake, success targets, baseline timing | 2–4 weeks | Agreed checklist, targets, PoC environment and data rules | Client SME time, FileOnQ admin, CIO contact |
| **1. PoC build** | §8.1 flow on synthetic data; Option A vs B benchmark | 4–6 weeks | End-to-end demo; metrics on the held-out set | Phase 0 checklist (a draft is enough to start), service access in the sandbox |
| **2. PoC evaluation** | Timed reviewer sessions with technicians; iterate once on corrections; optionally redacted real samples in an approved setting | 2–4 weeks | Metrics report against targets; go or no-go for pilot | Reviewer availability; data agreement if real samples are used |
| **3. Pilot** | Authorized environment; real mailbox in read-only or shadow mode; real FileOnQ integration if feasible | 8–16 weeks, **excluding ATO lead time** | Shadow-mode accuracy and time savings on live volume | ATO or authorization, FileOnQ interface, agency SSO |
| **4. Scale and S/4HANA alignment** | Production hardening; align with the S/4HANA roadmap; decide on bypassing FileOnQ | TBD | — | S/4HANA program timeline, funding |

### Roles

- **Guidehouse:** engagement lead; solution architect; AI/ML engineer; full-stack engineer; AP process SME/analyst. Pilot adds a security/ATO specialist and a test or quality lead.
- **Client:** process owners (Traci, Laurie); AP technicians as reviewers; FileOnQ administrator; CIO/ISSO; decision-makers (David, Beth).

### CONOPS contents

- actors and roles
- the to-be flow (§9 diagram)
- decision rights: who approves, who rejects, who sets thresholds
- exception handling and escalation
- the rejection workflow and timing
- audit and records
- metrics and reporting
- the phased path from human-reviews-everything to threshold-based routing

### Estimate drivers (for "the bill")

- team size × phase duration
- cloud and AI/OCR usage, which is per page and so depends on volume
- any per-page document-AI licensing
- ATO and security effort
- the client SME hours we ask for

No dollar figures until Phase 0 answers volume, environment and FileOnQ questions.

---

## Top 5 decisions before building the PoC

1. **When and how to send the corrections.** Send the §7.3 note before the plan, or fold it into the plan's cover note. Also decide whether to address the extra items in §7.2: "free", "any system", "designed for S/4HANA", auditor access, and the FEMA branding.
2. **Extraction approach and hosting.** Benchmark OCR+LLM against a document-AI service, or commit to one. Decide which cloud or sandbox to build in, ideally one aligned with what the client's CIO already authorizes.
3. **Integration realism.** For the mailbox, choose a real test mailbox or a simulated inbox folder. For FileOnQ, decide whether to pursue interface discovery with the client in parallel or stay mock-only until the pilot.
4. **Scope boundary and codebase.** Confirm the PoC stops at "FileOnQ record created", with COR, FFMS, Treasury, S/4HANA and the bypass excluded. Decide whether to build a new intake app or extend this reconciliation repo, which has reusable UI but simulated logic and browser-only storage.
5. **What you commit to in the plan and the bill.** Choose the success metrics to promise (recommended: false-accept rate as the gate, plus field accuracy and reviewer minutes), whether targets are set only after Phase 0, and how to package cost: PoC-only fixed scope versus phased PoC → pilot with go/no-go gates.
