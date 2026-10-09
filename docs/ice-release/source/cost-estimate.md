# Cost and Resource Estimate: Accounts Payable Invoice Intake Prototype

**Prepared for:** U.S. Immigration and Customs Enforcement, Office of the Chief Financial Officer, Office of Financial Management (OFM)

**Prepared by:** Guidehouse

**Status:** Draft for discussion, version 0.1, October 2026.

**[INSERT GUIDEHOUSE PROPRIETARY / PRICING LEGEND]**

---

## 1. Summary

This estimate covers the three phases in the accompanying project plan: discovery and design, prototype build, and prototype evaluation. It also gives an indicative estimate for an optional pilot, and it sets out the ICE staff time the work needs.

| Scope | Duration from award | Guidehouse labor hours | Price |
|---|---|---|---|
| Phases 0–2: Discovery, prototype build and evaluation | 8–14 weeks | 1,542 (range 1,124–1,960) | **[TO BE PRICED]** |
| Phase 3: Pilot (optional, indicative only) | 8–16 weeks, plus ICE authorization lead time | 2,400 (range 1,600–3,200) | **[TO BE PRICED]** |

The base hours assume Phase 0 takes 3 weeks, Phase 1 5 weeks and Phase 2 3 weeks. The ranges reflect the shortest and longest durations in the plan.

## 2. Proposed pricing structure

- **Phases 0–2: firm fixed price.** The prototype is well bounded: it uses synthetic invoices in a Guidehouse-provided environment and does not connect to ICE systems.
- **Phase 3 (pilot): optional.** It will be re-estimated and priced at the end of Phase 2, once discovery has confirmed FileOnQ's interface options, ICE's authorization requirements and live invoice volumes.
- **Decision point.** ICE decides whether to proceed to a pilot after reviewing the Phase 2 metrics report.

## 3. Labor by phase

### Phase 0: Discovery and design (2–4 weeks; base 3)

| Labor category | Level of effort (FTE) | Hours (base) |
|---|---|---|
| Engagement lead | 0.50 | 60 |
| Solution architect | 0.75 | 90 |
| AI/ML engineer | 0.50 | 60 |
| Full-stack engineer | 0.25 | 30 |
| AP process subject-matter expert | 1.00 | 120 |
| Security and compliance advisor | 0.25 | 30 |
| **Phase 0 total** | | **390** |

### Phase 1: Prototype build (4–6 weeks; base 5)

| Labor category | Level of effort (FTE) | Hours (base) |
|---|---|---|
| Engagement lead | 0.25 | 50 |
| Solution architect | 0.75 | 150 |
| AI/ML engineer | 1.00 | 200 |
| Full-stack engineer | 1.00 | 200 |
| AP process subject-matter expert | 0.50 | 100 |
| Security and compliance advisor | 0.10 | 20 |
| **Phase 1 total** | | **720** |

### Phase 2: Prototype evaluation (2–4 weeks; base 3)

| Labor category | Level of effort (FTE) | Hours (base) |
|---|---|---|
| Engagement lead | 0.50 | 60 |
| Solution architect | 0.50 | 60 |
| AI/ML engineer | 1.00 | 120 |
| Full-stack engineer | 0.50 | 60 |
| AP process subject-matter expert | 1.00 | 120 |
| Security and compliance advisor | 0.10 | 12 |
| **Phase 2 total** | | **432** |

### Phase 3: Pilot (optional; indicative; 8–16 weeks; base 12)

| Labor category | Level of effort (FTE) | Hours (base) |
|---|---|---|
| Engagement lead | 0.50 | 240 |
| Solution architect | 1.00 | 480 |
| AI/ML engineer | 1.00 | 480 |
| Full-stack engineer | 1.00 | 480 |
| AP process subject-matter expert | 0.50 | 240 |
| Security and compliance advisor (authorization support) | 0.50 | 240 |
| Test and quality lead | 0.50 | 240 |
| **Phase 3 total** | | **2,400** |

## 4. Other direct costs

| Item | Phases 0–2 | Pilot (optional) |
|---|---|---|
| Prototype hosting environment | **[TO BE PRICED]** | Not applicable (ICE-authorized environment) |
| OCR, document-AI and language-model service usage | **[TO BE PRICED]** | **[TO BE PRICED]**, scales with invoice volume |
| Travel | **[TO BE PRICED / none assumed]** | **[TO BE PRICED / none assumed]** |

## 5. ICE resources required

These hours are estimates and will be confirmed in Phase 0.

| ICE role | Phase 0 | Phase 1 | Phase 2 | Pilot (optional) |
|---|---|---|---|---|
| Executive sponsors | Gate review (1–2 hours) | — | Gate review (1–2 hours) | Monthly reviews |
| Process owners (2) | 2–4 hours per week each | 1–2 hours per week each | 2–4 hours per week each | 2–4 hours per week each |
| AP technicians (3–5) | Baseline timing, 1–2 hours each | — | Timed review sessions, 3–6 hours each | Shadow-mode participation (to be scoped) |
| FileOnQ administrator | 2–6 hours | — | — | Integration support (to be scoped) |
| CIO's office / ISSO | 2–4 hours | As needed | — | Authorization activities per ICE process |

## 6. What the prototype will measure

The prototype will give ICE measured results, not projections:

- technician minutes per invoice, compared with a baseline measured in Phase 0
- field-level accuracy, including on invoice layouts the system has never seen
- the share of invoices marked ready for review that actually contain an error
- detection of improper invoices

ICE can apply these results to its own invoice volume and labor costs to estimate the benefit of a pilot and of production use.

## 7. Assumptions and exclusions

1. The prototype uses synthetic data only, in a Guidehouse-provided environment, with no connection to ICE systems.
2. ICE provides its proper-invoice checklist, or confirms a draft based on FAR 32.905(b), during Phase 0.
3. ICE staff are available at the levels in Section 5.
4. **Excluded:**
   - ICE's authorization (ATO) process itself
   - FileOnQ licensing or vendor changes
   - production deployment
   - integration with the financial system, Treasury or SAP S/4HANA
5. If Phase 0 finds a material change to these assumptions, Guidehouse will propose the change in writing before work proceeds.
