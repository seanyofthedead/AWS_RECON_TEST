# DRAFT — Project Plan: Accounts Payable Invoice Intake Prototype

**Prepared for:** ICE Office of the Chief Financial Officer, Office of Financial Management (OFM)
**Prepared by:** Guidehouse
**Status:** Draft for internal review. Not yet approved for release. Version 0.1, October 2026.

---

## 1. Purpose

ICE OFM's accounts payable team receives vendor invoices as attachments in a shared mailbox. Technicians review each one for the data elements of a proper invoice and create a record in FileOnQ. That intake step is the team's largest bottleneck. Earlier automation has struggled because every vendor formats invoices differently.

This project builds and evaluates a prototype that reads invoices from a mailbox, extracts and checks the required data, gives a technician a ready-to-approve record, and produces a FileOnQ-ready record with the invoice attached. A technician reviews every record. The prototype will show measured results, not promised ones, so ICE can decide on a pilot with evidence.

## 2. Objectives

1. **Reduce technician effort at intake.** Show that extraction and validation can turn manual data entry into review and approval, and measure the minutes saved per invoice.
2. **Handle vendor variety.** Show accuracy on invoice layouts the system has never seen, not only on layouts it was tuned on.
3. **Catch improper invoices early.** Flag missing required data elements with specific reasons before a record is created.
4. **Keep people in control.** No record is created without technician approval. Every extraction, edit and decision is logged.
5. **Give ICE a decision basis.** Deliver a metrics report and a pilot recommendation at the end of the prototype.

## 3. Scope

### In scope
- Ingesting invoice emails and PDF attachments from a **test mailbox** (prototype) and identifying which attachments are invoices.
- Extracting invoice data fields from varied vendor layouts.
- A confidence score for each field and an overall status for each invoice: *Ready for review*, *Needs attention*, or *Likely improper*.
- Validation against ICE's required data elements, plus arithmetic and format checks.
- A technician review screen: the invoice beside the extracted data, with approve, correct and reject actions and reason codes.
- Creating a **FileOnQ-ready record** with the PDF attached, through a mock FileOnQ interface in the prototype.
- Drafted rejection notices listing the missing elements. Notices are drafted only, not sent.
- A server-side audit log and a metrics report.
- Discovery and documentation of FileOnQ integration options, for the pilot.

### Out of scope (this phase)
- Connecting to ICE's production mailbox, FileOnQ, FFMS or other ICE systems during the prototype.
- Field approval (receiving and acceptance by the contracting officer's representative), certification, and Treasury payment. These steps are unchanged.
- Processing without technician review.
- SAP S/4HANA integration and replacing FileOnQ. Both are addressed as future options in the CONOPS.
- Use of real ICE invoice data, unless ICE approves it in writing and provides an approved environment.

## 4. Approach and phases

The work runs in phases with a decision point before any pilot. Durations are ranges measured from contract award. They depend on the assumptions in §8.

| Phase | Duration | What happens | Exit criteria (deliverables) |
|---|---|---|---|
| **0. Discovery and design** | 2–4 weeks | Confirm the current process and the proper-invoice checklist. Learn FileOnQ's interface options. Agree success targets. Measure baseline technician time. Agree the prototype environment and data rules with the CIO's office. Re-baseline this plan | Discovery report; agreed validation checklist; success targets; updated plan and CONOPS |
| **1. Prototype build** | 4–6 weeks | Build the intake flow on **synthetic invoices** (fictional vendors, 8–12 layouts, edge cases). Compare at least two extraction approaches on the same test set | Working prototype; interim accuracy results |
| **2. Prototype evaluation** | 2–4 weeks | Timed review sessions with ICE technicians. Measure accuracy on held-out layouts. Make one improvement cycle from technician corrections | Metrics report; pilot recommendation; draft pilot plan and estimate |
| **Decision point** | — | ICE decides whether to proceed to a pilot | Go or no-go from ICE |
| **3. Pilot (optional)** | 8–16 weeks, plus ICE authorization lead time | Run in an ICE-authorized environment on live invoices in *shadow mode*: the system processes alongside technicians without replacing their work. Build a FileOnQ integration if a viable interface exists | Pilot results; production recommendation |

**Total for Phases 0 to 2: about 8 to 14 weeks from award.**

## 5. Deliverables

| ID | Deliverable | Phase | Acceptance |
|---|---|---|---|
| D1 | Discovery report: current-state process, validation checklist, FileOnQ interface findings, baseline measures | 0 | ICE process owners confirm accuracy |
| D2 | Updated project plan and CONOPS | 0 | ICE approval |
| D3 | Success targets and measurement method | 0 | ICE approval |
| D4 | Synthetic invoice test set with known correct values | 1 | Covers agreed layouts and edge cases |
| D5 | Working prototype: ingestion, extraction, validation, review screen, mock FileOnQ record, audit log | 1 | Live demonstration on invoices not used in development |
| D6 | Security and data-handling summary for the CIO's office | 0–1 | Accepted by the CIO's office for the prototype environment |
| D7 | Metrics report: field accuracy, rate of invoices wrongly marked ready, technician minutes per invoice, improper-invoice detection | 2 | Measured against D3 targets |
| D8 | Pilot recommendation, with a draft pilot plan and estimate | 2 | Supports ICE's go or no-go decision |

## 6. Team and responsibilities

### Guidehouse

| Role | Responsibility |
|---|---|
| Engagement lead | Overall delivery, ICE coordination, decision points |
| Solution architect | Design, integration options, environment, FileOnQ discovery |
| AI/ML engineer | Extraction, confidence scoring, accuracy measurement |
| Full-stack engineer | Ingestion, review screen, audit log, mock FileOnQ interface |
| AP process SME | Current-state process, validation checklist, test data design, technician sessions |
| Security and compliance advisor | Data handling, CIO's office engagement, pilot authorization path |

### ICE

Hours are estimates, to confirm in Phase 0.

| Role | Responsibility | Estimated time |
|---|---|---|
| Executive sponsors (David Dalenberg, Beth Baden) | Direction; decisions at each phase gate | Gate reviews |
| Process owners (Traci Billings, Laurie Nadeau) | Process and checklist validation; prioritization; review of deliverables | 2–4 hours per week |
| AP technicians (3–5) | Baseline timing (Phase 0); timed review sessions (Phase 2) | About 4–8 hours each across Phases 0 and 2 |
| FileOnQ administrator | Interface options; test environment availability | About 2–6 hours in Phase 0 |
| CIO's office / ISSO | Prototype environment and data rules; pilot authorization path | About 2–4 hours in Phase 0, more for a pilot |

## 7. Governance

- **Weekly working session** with the process owners.
- **Phase-gate reviews** with the executive sponsors at the end of Phases 0 and 2.
- **Change control.** If Phase 0 findings materially change scope, schedule or cost (§8), Guidehouse proposes the change in writing before acting on it.

## 8. Assumptions

This plan was prepared before discovery. It rests on the assumptions below, each of which Phase 0 will confirm or correct.

| # | Assumption | If it is wrong |
|---|---|---|
| A1 | Most invoices arrive as PDF attachments, and a meaningful share are scans | More scanned or image-only invoices may lower accuracy and add OCR work |
| A2 | ICE can provide its proper-invoice checklist in Phase 0 | Guidehouse drafts one from FAR 32.905(b) for ICE to confirm, which adds time |
| A3 | The prototype uses synthetic data and a Guidehouse-provided environment with no connection to ICE systems, and the CIO's office agrees this needs no ATO | An ICE-hosted prototype or the use of real data adds authorization time |
| A4 | ICE staff are available at the levels in §6 | Phases 0 and 2 extend |
| A5 | FileOnQ's interface options can be learned from ICE staff and documentation in Phase 0 | FileOnQ integration in the pilot may need a different approach, such as bulk import or the existing OFM automation |
| A6 | Prototype success targets are set in Phase 0 from baseline measures | — |
| A7 | Pilot scope, schedule and cost are estimated at the end of Phase 2 | — |

## 9. Key risks

| Risk | Mitigation |
|---|---|
| Accuracy on ICE's real invoices is lower than on synthetic ones | Synthetic layouts are designed with ICE's input in Phase 0. The pilot runs in shadow mode first, and the technician reviews every record throughout |
| FileOnQ has no practical integration path | Investigated in Phase 0. The prototype uses a separate interface layer, so the destination system can change |
| Authorization lead time for the pilot | Engage the CIO's office in Phase 0. Prefer services ICE has already authorized |
| ICE staff availability | Keep asks small and scheduled in advance (§6) |
| The S/4HANA transition changes the target system | The design keeps intake separate from the destination system (see CONOPS §9) |

## 10. Schedule (relative to award)

| Week | Milestone |
|---|---|
| 0 | Contract award; kickoff |
| 2–4 | Discovery report (D1); updated plan and CONOPS (D2); targets (D3); Phase 0 gate review |
| 6–10 | Working prototype demonstration (D5) |
| 8–14 | Metrics report (D7); pilot recommendation (D8); Phase 2 gate review |
