# DRAFT — Pricing Estimate: Accounts Payable Invoice Intake Prototype

**Prepared for:** ICE OCFO, OFM
**Prepared by:** Guidehouse
**Status:** INTERNAL DRAFT. The labor-hour basis is complete. Rates, other direct costs (ODCs) and fee must be filled in by Guidehouse pricing and approved before release. Version 0.1, October 2026.

---

## 1. Summary

This estimate covers Phases 0 to 2 of the project plan (discovery, prototype build, prototype evaluation) and gives a rough order of magnitude for an optional pilot. It also answers "what do we have to resource" on ICE's side (§5).

| Scope | Duration | Guidehouse labor hours (low / base / high) | Price |
|---|---|---|---|
| Phases 0–2: Discovery and prototype | 8–14 weeks | 1,124 / 1,542 / 1,960 | [to be priced] |
| Phase 3: Pilot, optional (rough order of magnitude; re-estimated at the end of Phase 2) | 8–16 weeks plus ICE authorization lead time | 1,600 / 2,400 / 3,200 | [to be priced] |

- **Base** assumes Phase 0 takes 3 weeks, Phase 1 5 weeks and Phase 2 3 weeks.
- **Low and high** use the shortest and longest durations in the plan, with the same staffing levels.
- Hours = full-time equivalent (FTE) × 40 hours × weeks.

## 2. Labor detail, Phases 0–2

### Phase 0: Discovery and design (2 / 3 / 4 weeks)

| Role | FTE | Hours (low / base / high) | Rate | Extended (base) |
|---|---|---|---|---|
| Engagement lead | 0.50 | 40 / 60 / 80 | [rate] | [ ] |
| Solution architect | 0.75 | 60 / 90 / 120 | [rate] | [ ] |
| AI/ML engineer | 0.50 | 40 / 60 / 80 | [rate] | [ ] |
| Full-stack engineer | 0.25 | 20 / 30 / 40 | [rate] | [ ] |
| AP process SME | 1.00 | 80 / 120 / 160 | [rate] | [ ] |
| Security and compliance advisor | 0.25 | 20 / 30 / 40 | [rate] | [ ] |
| **Phase 0 total** | | **260 / 390 / 520** | | [ ] |

### Phase 1: Prototype build (4 / 5 / 6 weeks)

| Role | FTE | Hours (low / base / high) | Rate | Extended (base) |
|---|---|---|---|---|
| Engagement lead | 0.25 | 40 / 50 / 60 | [rate] | [ ] |
| Solution architect | 0.75 | 120 / 150 / 180 | [rate] | [ ] |
| AI/ML engineer | 1.00 | 160 / 200 / 240 | [rate] | [ ] |
| Full-stack engineer | 1.00 | 160 / 200 / 240 | [rate] | [ ] |
| AP process SME | 0.50 | 80 / 100 / 120 | [rate] | [ ] |
| Security and compliance advisor | 0.10 | 16 / 20 / 24 | [rate] | [ ] |
| **Phase 1 total** | | **576 / 720 / 864** | | [ ] |

### Phase 2: Prototype evaluation (2 / 3 / 4 weeks)

| Role | FTE | Hours (low / base / high) | Rate | Extended (base) |
|---|---|---|---|---|
| Engagement lead | 0.50 | 40 / 60 / 80 | [rate] | [ ] |
| Solution architect | 0.50 | 40 / 60 / 80 | [rate] | [ ] |
| AI/ML engineer | 1.00 | 80 / 120 / 160 | [rate] | [ ] |
| Full-stack engineer | 0.50 | 40 / 60 / 80 | [rate] | [ ] |
| AP process SME | 1.00 | 80 / 120 / 160 | [rate] | [ ] |
| Security and compliance advisor | 0.10 | 8 / 12 / 16 | [rate] | [ ] |
| **Phase 2 total** | | **288 / 432 / 576** | | [ ] |

### Phase 3: Pilot (optional; rough order of magnitude) (8 / 12 / 16 weeks)

| Role | FTE | Hours (low / base / high) |
|---|---|---|
| Engagement lead | 0.50 | 160 / 240 / 320 |
| Solution architect | 1.00 | 320 / 480 / 640 |
| AI/ML engineer | 1.00 | 320 / 480 / 640 |
| Full-stack engineer | 1.00 | 320 / 480 / 640 |
| AP process SME | 0.50 | 160 / 240 / 320 |
| Security and compliance advisor (authorization support) | 0.50 | 160 / 240 / 320 |
| Test/QA lead | 0.50 | 160 / 240 / 320 |
| **Phase 3 total** | | **1,600 / 2,400 / 3,200** |

The pilot estimate is the least certain figure in this document. It depends on FileOnQ's interface, ICE's authorization requirements and live invoice volume, all of which are unknown until Phase 0. It should be presented as an option to be re-priced, not a commitment.

## 3. Other direct costs (ODCs)

| Item | Phases 0–2 | Pilot | Basis |
|---|---|---|---|
| Prototype hosting environment (Guidehouse-provided sandbox) | [ ] | — | Small environment for 8–14 weeks. The pilot runs on Databricks or Azure in ICE's cloud environment, whichever is available (confirmed in Phase 0); ICE-side platform costs are not included |
| OCR, document-AI and LLM service usage | [ ] | [ ] | Usage-based. Prototype volume is small (a synthetic set of 100–200 documents, run repeatedly). Pilot cost scales with ICE's monthly invoice volume, which is unknown |
| Synthetic test data generation | Included in labor | — | |
| ICE-side environment, licensing, FileOnQ changes | Not included | Not included | ICE responsibility, if any |
| Travel | [ ] | [ ] | Assumed minimal or none |

## 4. Pricing structure options

Choose one with contracts and pricing before release.

| Option | Structure | Pros | Cons |
|---|---|---|---|
| **A (recommended)** | **Firm fixed price for Phases 0–2.** Pilot as a separately priced option, re-estimated at the Phase 2 gate | Matches "a smaller bite"; the price is clear for the sponsors; the prototype is well bounded because it uses synthetic data in our environment | We carry the risk on Phase 0 surprises. Cover it with the stated assumptions and change control |
| B | Time-and-materials for Phases 0–2 with a not-to-exceed ceiling at the high estimate | Flexible if discovery finds surprises | Less certainty for ICE |
| C | Phase-by-phase task orders (Phase 0 first, then 1–2) | Smallest first commitment | More contracting overhead; slower start of the build |

Possible CLIN layout (for the contracting team to confirm against the vehicle):
- CLIN 0001: Phases 0–2 labor
- CLIN 0002: ODCs
- Optional CLIN 0003: pilot labor
- Optional CLIN 0004: pilot ODCs

## 5. ICE resources required ("what do we have to resource")

These hours are estimates, to confirm in Phase 0.

| ICE role | Phase 0 | Phase 1 | Phase 2 | Pilot |
|---|---|---|---|---|
| Executive sponsors | Gate review (1–2 h) | — | Gate review (1–2 h) | Monthly reviews |
| Process owners (2) | 2–4 h per week each | 1–2 h per week each | 2–4 h per week each | 2–4 h per week each |
| AP technicians (3–5) | Baseline timing, 1–2 h each | — | Timed review sessions, 3–6 h each | Shadow-mode participation (to be scoped) |
| FileOnQ administrator | 2–6 h | — | — | Integration support (to be scoped) |
| CIO's office / ISSO | 2–4 h | As needed | — | Authorization effort (ICE process) |

## 6. Assumptions and exclusions

1. The prototype uses **synthetic data only**, in a Guidehouse-provided environment, with no connection to ICE systems.
2. ICE provides its proper-invoice checklist, or confirms a draft based on FAR 32.905(b), in Phase 0.
3. ICE staff are available at the levels in §5.
4. **Excluded:** the ICE authorization (ATO) process itself; FileOnQ licensing or vendor changes; production deployment; integration with FFMS, Treasury or SAP S/4HANA.
5. A material change to these assumptions found in Phase 0 is handled through change control before work proceeds.

## 7. How to describe value

Do not promise headcount or accuracy outcomes in the price volume. Instead:

- **What we commit to measure:** technician minutes per invoice before and after, field accuracy on unseen layouts, and the rate of invoices wrongly marked ready.
- **What ICE can calculate from the results:** labor hours returned to the team, using its own volume and loaded labor cost.
- **The labor and rework ICE described** (intake staffing and multiple quality reviews) is the opportunity the prototype tests, not a guaranteed outcome.

## 8. Before release (internal)

- [ ] Rates applied by pricing; fee and wrap rates per policy
- [ ] ODCs priced, including the per-page service cost at prototype volume
- [ ] Pricing structure chosen (§4) and vehicle confirmed by contracts
- [ ] Staffing confirmed to match the FTE levels
- [ ] Engagement lead approval
