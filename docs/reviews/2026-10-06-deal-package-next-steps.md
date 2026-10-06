# What we owe David to move the ICE AP intake deal forward

Prepared October 6, 2026. This builds on [the Oct 5 demo review](2026-10-05-client-demo-review-and-poc-scope.md), which holds the quotes, requirements, architecture options and open questions; section numbers marked "§" refer to that review. Timestamps are from the Oct 5 transcript.

## Who decides, and what David asked for

**David Dalenberg** asked for the package and decides with **Beth Baden**: "we we need a kind of a project plan pulled together between you and Sean or Felice or whoever. You know, so Beth and I can sit down, review it, and figure out if, when, and how we're going to incorporate this" (34:32–34:58). Beth needs a copy of everything David gets.

David named the contents at 38:53: "I'm just looking for project plan, concept of ops, you know, all the normal kind of grassroots stuff, and then a bill. You know, what do we have to resource."

David also set the scope ("let's take a smaller bite at the apple, work and focus in on the AP stuff") and handed prototype design to **Traci Billings and Laurie Nadeau** ("I'll leave it to Tracy and and Lori and the team to kind of figure out … who needs to do what when it comes to prototyping", 38:53). Traci and Laurie should therefore review drafts before David sees them.

## What David needs to see to say yes

Each item below is something David raised. The right-hand column shows which deliverable answers it.

| David's concern or goal | Quote (time) | Answered by |
|---|---|---|
| Relief on intake, the top priority | "I'm most interested in getting Tracy and the team some relief on that initial ingest and review process" (35:57); "that's my number one focus area is that ingest intake process" (36:41) | B3 scope and B6: the PoC targets intake only |
| Bots weren't enough; vendor layouts vary | "the bot stuff had to be not perfect, but pretty close in order to work" (30:09); "bots helped a little bit, but not enough" (36:41) | B6: PoC tested on vendor layouts held out from tuning |
| Labor: about 30 people down to 2 or 3 | "go from the need of having 30 people down to maybe two or three" (31:23) | B5 value framing: measured reviewer minutes per invoice, not a headcount promise |
| Rework from repeated QC | "The same kind of record goes through 345, hands doing nothing but quality check reviews … spending $1 to save a nickel" (36:20) | B4: where validated extraction could replace QC passes; B8 asks what each pass checks |
| Human in the loop at intake | "I don't think we'll ever get away from having to have a human in the loop at intake" (31:23) | B4: human review is built into the CONOPS |
| Learning and improvement | "then it learns as it goes" (30:09) | B1 corrects this; B4 describes the managed improvement process |
| Accuracy at first run (*attribution uncertain*: labelled Speaker 14, probably David) | "At the first instance of running this, what can we expect for the accuracy rates?" (32:06) | B3 risk section and B6 metrics: measured on held-out invoices, gated on the rate of invoices wrongly marked ready (§11) |
| Possibly eliminating FileOnQ and its licensing cost | "maybe we can get to the position where we can bypass or completely eliminate file on queue … cost reduction on licensing" (31:23) | B3 phase 4 and B4 transition section: kept as a later decision, and the design keeps the option open |
| The client's own labor cost | "maybe it's going to take some labor. So I know we're going to get some pushback there, some subject matter expertise labor" (34:32) | B5 client-resource estimate: SME hours, kept small and stated per phase |
| Start small | "let's take a smaller bite at the apple" (38:53) | B5 pricing options: a fixed PoC or phases with go/no-go points |

## Part A — Internal readiness before the package goes to David

| # | Item | What it contains | Why it's needed |
|---|---|---|---|
| A1 | **Opportunity summary** (1 page) | Client: ICE OCFO, OFM accounts payable. Ask: intake automation, mailbox → validated FileOnQ record (16:50, 25:02). Decision-makers: David and Beth. Next step: plan, CONOPS and "a bill" (38:53). Upside: department-level interest (37:36, 37:58) and budget-intelligence follow-on (40:00) | Go/no-go on pursuing |
| A2 | **Claims-correction disclosure** | The four overclaims from the demo (§7.1) and the plan to correct them in writing (§7.3), plus the other statements flagged in §7.2 | Reputational and contractual risk. Our account lead should sign off before anything else is sent |
| A3 | **Contract-vehicle and scope check** | Is this work in scope of an existing ICE task order, or does it need a modification or new vehicle? The "under 10%" remark (38:26) is garbled and needs an answer. Is there any organizational-conflict-of-interest question if Guidehouse also supports ICE audit or internal-controls work? (The "audit perspective" speaker at 37:36 suggests that area is involved.) | Determines whether we can propose at all, and how |
| A4 | **Staffing plan** | Named or TBD people for the roles in §12: engagement lead, solution architect, AI/ML engineer, full-stack engineer, AP process SME; ATO specialist for the pilot. Availability for the first 2 to 4 weeks | Credibility of the schedule in the plan |
| A5 | **Pricing approval** | Labor build from the estimate template (B5) at approved rates, other direct costs, and pricing structure (fixed-price PoC versus time-and-materials versus phased with gates) | Nothing with a dollar figure goes to the client without this |
| A6 | **AI and data-handling review** | Confirmation that the PoC uses synthetic data only, the hosting choice, which AI/OCR services are used, and that no client data enters a non-authorized environment | Firm policy and client trust |
| A7 | **Quality review of client-facing documents** | A second reader checks B1 to B7 against §7: no "learns as it goes", no "immutable", no "very easily", no unverified FileOnQ API claims | Avoid repeating the demo's problems |

---

## Part B — The package for David and Beth

David asked for three things by name (38:53): a **project plan**, a **concept of operations**, and **"a bill. You know, what do we have to resource."** B3 to B5 deliver those. B1, B2 and B6 to B8 make them credible and let the client act on them.

### B1. Follow-up note with the corrections — send first

- **What:** the email drafted in §7.3, sent by Sean, thanking the team, restating the intake focus, correcting the four claims, and asking for a short discovery call.
- **To:** Traci, Laurie, David and Beth, plus whoever else the account lead advises (Shilonda Holmes and Cathaleen Winter were on the invite).
- **Timing (proposed):** within a few days of the demo, before or with the slides. It must go out before the plan does.
- **Done when:** approved by the account lead (A2) and sent.

### B2. The slides from Oct 5

- **What:** Felice promised to share them: "we'll share these slides after this discussion" (2:49).
- **Before sending:** remove or reword anything that repeats the four claims. Add a short "what the demo simulated" note if the slides show the demo.
- **Done when:** sent with or just after B1.

### B3. Project plan

The document David and Beth will "sit down, review" (34:58). Suggested structure:

1. **Objective,** in the client's words: relief on "that initial ingest and review process" (David, 35:57) and Laurie's quick win (25:02).
2. **Scope.**
   - In scope: shared-mailbox intake, extraction, validation against required elements, confidence, human review, a FileOnQ-ready record (mock in the PoC), and rejection reasons.
   - Out of scope for now: COR approval, FFMS and Treasury interfaces, bypassing FileOnQ, and S/4HANA integration. Name each so there are no surprises (§8.1).
3. **Phases and gates** (§12): 0 Discovery (2–4 weeks) → 1 PoC build (4–6 weeks) → 2 PoC evaluation (2–4 weeks) → **go/no-go** → 3 Pilot (8–16 weeks plus ATO lead time) → 4 Scale and S/4HANA alignment (TBD).
   - Each phase lists its exit criteria.
   - Durations are ranges with their assumptions stated.
4. **Milestones and deliverables per phase:**
   - Phase 0: agreed invoice checklist and targets.
   - Phase 1: working PoC demo.
   - Phase 2: metrics report.
   - Pilot: an approved environment and shadow-mode results.
5. **Team and client responsibilities.** Our roles, and the client roles David anticipated ("some subject matter expertise labor", 34:32): process owners, technician reviewers, FileOnQ administrator, CIO/ISSO. Give an estimated hours-per-week range for each.
6. **Dependencies:**
   - the client's proper-invoice checklist
   - FileOnQ interface discovery
   - the CIO approval path
   - SME availability
   - the S/4HANA timeline
7. **Risks and mitigations** (§11). Include the honest accuracy answer.
8. **Governance:** a weekly working session with Traci and Laurie, and a decision review with David and Beth at each gate.

**Done when:** Traci and Laurie have reviewed a draft before it goes to David and Beth. This matches David's direction that the plan be "pulled together between you and Sean or Felice" (34:58).

### B4. Concept of operations (CONOPS)

How intake will work day to day once the solution is in place. Suggested structure:

1. **Current state:** the flow in §2, validated with Traci.
2. **Future state:** the §9 diagram in plain language.
   - Mailbox → ingest → extract → validate → confidence → technician review → FileOnQ record → field approval → financial system → Treasury.
   - Show clearly which steps change and which don't.
3. **Actors and decision rights:**
   - Who reviews, approves and rejects.
   - Who sets confidence thresholds and the required-element checklist.
   - Who handles exceptions.
4. **Human in the loop.** Every record is reviewed until measured accuracy meets a threshold the client sets. Any later routing by confidence level is a client decision made on measured results (N1).
5. **Rejection workflow:** reason codes, vendor notice, and timing. Confirm the Prompt Payment rules timing with the client (§10 Q17).
6. **Audit and records:** a server-side, append-only log of every extraction, edit and decision (N2), and the retention period (§10 Q25).
7. **Metrics and reporting** (§8.4): field accuracy, rate of invoices wrongly marked ready, auto-validated share, and reviewer minutes per invoice.
8. **How improvement works:** corrections are captured, measured and fed back through a managed process (§11). This replaces "learns as it goes".
9. **Security and environment:** reference B7.
10. **Transition:** how the design survives the move to S/4HANA (adapter boundary, §9).

### B5. The estimate ("a bill")

David asked "what do we have to resource" (38:53), so the estimate needs both what the client pays us and what the client must staff.

- **Our cost,** by phase:
  - roles × duration ranges
  - other direct costs: cloud hosting, OCR or document-AI usage per page, LLM usage per page
  - per-page licensing if a document-AI service is chosen
- **Client resources,** by phase:
  - technician reviewer hours
  - process-owner hours
  - FileOnQ administrator time
  - CIO/ISSO time
  - any client-side environment or licensing
- **Pricing options** to put before David and Beth:
  - **Option 1:** a fixed-price PoC (Phases 0 to 2) with a separate pilot estimate.
  - **Option 2:** the full path, priced per phase, with go/no-go gates.

  Gates keep the commitment small, matching "a smaller bite at the apple" (38:53).
- **Assumptions and exclusions,** stated plainly:
  - synthetic data in the PoC
  - no client system access before the pilot
  - FileOnQ integration effort unknown until discovery
  - ATO effort and timeline driven by the client's process
- **Value framing,** labelled as to be measured, not promised:
  - the labor and rework David described: 30 people (31:23) and 3–5 QC passes (36:20)
  - the baseline the PoC will measure: reviewer minutes per invoice

  Do not put "30 to 2–3" in our estimate as an outcome.

**No dollar figures until A5 is approved.** Usage-based costs depend on monthly volume, which ICE has not given us (§10 Q1).

### B6. PoC definition and success criteria (1–2 pages; can be an appendix to B3)

- The end-to-end flow in §8.1, and the build-versus-simulate table in §8.2.
- The synthetic data approach: fictional vendors only, 8–12 layouts, some layouts held out from tuning (§8.3).
- The metrics in §8.4, with targets to be agreed in Phase 0. The rate of invoices wrongly marked ready is the gating metric.
- What the client will see at the end of the PoC: a live run on unseen invoices and a metrics report.

### B7. Security and data-handling summary for the CIO (1–2 pages)

The CIO approval gate came up repeatedly (18:22, 20:25), so give the CIO's office something concrete early.

- **PoC:** synthetic data only, the hosting environment, identity, no connection to ICE systems, and a list of components and services.
- **Pilot:** FedRAMP-authorized services only, the expected ATO path, and PII handling. Invoices carry tax IDs and banking details.
- **AI governance:** human oversight, testing documentation, and the agency's AI-use inventory if required.
- **Questions for the CIO's office:** §10 Q12–Q14.

### B8. Discovery request (data and access list)

Send this with the plan, or ahead of it, so Phase 0 can start as soon as the client says yes. Draw it from §10, prioritized:

1. **The proper-invoice checklist technicians use today.** This is the single most important input.
2. Monthly invoice volume and peak volume; number of vendors and how concentrated volume is among them.
3. FileOnQ: version, hosting, interface options, test environment, administrator contact.
4. What the existing OFM bots do.
5. Baseline effort: minutes per invoice and what each of the 3–5 QC passes checks.
6. The CIO/ISSO contact and the sandbox rules.
7. Whether historical invoices with keyed values could be used later, and under what terms.
8. A few redacted real invoice layouts, if permitted, to inform the synthetic set. Optional.

### Optional: a refreshed intake demo

Not required to move forward, and not recommended before B1 to B5 are out. If a demo is wanted, show the intake flow on synthetic invoices, label every simulated element, and remove the "FEMA · DEMO" branding (§7.2). A second demo that over-promises would undo B1.

---

## Proposed sequence

All timing below is a proposal, not something the client asked for.

| When (from Oct 6) | Step |
|---|---|
| Days 1–3 | Internal: A1, A2, A3. Account lead approves B1 |
| Days 2–5 | Send **B1** (corrections) and **B2** (slides); request a discovery call |
| Week 1–2 | Discovery call with Traci and Laurie; collect B8 answers. Internal: A4, A6 |
| Week 2–3 | Draft **B3, B4, B6, B7**; build B5 at approved rates (A5); quality review (A7) |
| Week 3 | Review drafts with Traci and Laurie |
| Week 3–4 | Send the final package to David and Beth; offer a walkthrough |

The Holly and Mr. Bovich meeting "in about two weeks" (37:58, so around Oct 19) is a department-level conversation. It is separate from this AP deal, but whoever attends should know the B1 corrections have gone out, so the department hears the same accurate story.

## Ready-to-send checklist

- [ ] Beth receives everything David does
- [ ] The correction note (B1) is sent, and the slides (B2) are scrubbed and sent
- [ ] The contract vehicle and any conflict-of-interest question are answered (A3)
- [ ] Staffing is confirmed (A4) and pricing approved (A5)
- [ ] The plan, CONOPS, estimate, PoC definition and security summary have been reviewed by Traci and Laurie
- [ ] None of the documents contains "learns as it goes", "immutable", "very easily", "free", "vetted by DoD" or invented FileOnQ details
- [ ] The discovery request (B8) has gone to the client
- [ ] There is a named owner and a date for each deliverable
