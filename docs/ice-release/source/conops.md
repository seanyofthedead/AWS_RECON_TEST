# Concept of Operations: Accounts Payable Invoice Intake

**Prepared for:** U.S. Immigration and Customs Enforcement, Office of the Chief Financial Officer, Office of Financial Management (OFM)

**Prepared by:** Guidehouse

**Status:** Draft for discussion, version 0.1, October 2026. The current-state description reflects our understanding from our October 5, 2026 meeting and will be validated in Phase 0.

---

## 1. Purpose

This document describes how invoice intake would work with the proposed capability: who does what, what the system does, where people make decisions, and how the operation is controlled and measured. It covers the prototype, a possible pilot, and the intended steady state.

## 2. Current state (as we understand it)

1. Vendors email invoices, usually as PDF attachments, to a **shared mailbox**.
2. **AP technicians** check the mailbox every day.
3. Technicians review each invoice for the **data elements of a proper invoice**.
4. Technicians create a **FileOnQ record** and enter the required data fields. FileOnQ is OFM's invoice repository and workflow tool up to certification and payment.
5. Improper invoices are **rejected**.
6. Records go through **several quality-check reviews**.
7. Through FileOnQ, the invoice goes **to the field** for receiving and acceptance by the contracting officer's representative (COR) or other responsible official.
8. The record returns through FileOnQ and **interfaces to the financial system** for certification and **payment by Treasury**.

**Pain points:**
- Steps 2 to 4 are labor-intensive and the main bottleneck.
- Vendor layout variety has limited earlier automation.
- Repeated quality reviews add rework.

## 3. Future state overview

Steps 1 to 4 change, and the quality reviews in step 6 are expected to shrink. Steps 7 and 8 are unchanged.

| Step | What happens | Who |
|---|---|---|
| 1 | Vendor emails the invoice to the shared mailbox, as today | Vendor |
| 2 | Collect emails and attachments; identify invoices; split multi-invoice files | Intake service |
| 3 | Extract invoice data and record where each value was found | Intake service |
| 4 | Validate against the required elements; check arithmetic, formats and duplicates | Intake service |
| 5 | Score confidence and assign a status | Intake service |
| 6 | Review in the queue: approve, correct or reject | AP technician |
| 7a | On approval: create the FileOnQ record with the PDF attached | Intake service, after technician approval |
| 7b | On rejection: draft a notice for the technician to review and send | Intake service drafts; technician sends |
| 8 | Unchanged: field approval (COR), financial system, certification, Treasury payment | Existing process |

Every step writes to a server-side audit log.

## 4. Actors and responsibilities

| Actor | Responsibilities |
|---|---|
| **Vendor** | Submits invoices by email, as today. No change for vendors |
| **Intake service** (system) | Collects, identifies, extracts, validates and scores invoices, and prepares records. Never creates a FileOnQ record without technician approval |
| **AP technician** | Reviews each invoice in the queue. Approves, corrects or rejects. Sends rejection notices |
| **AP lead / process owner** | Owns the validation checklist and reason codes. Monitors the queue and metrics. Approves rule changes |
| **Executive sponsors** | Approve phase transitions and any change to how much review is required |
| **CIO's office / ISSO** | Authorizes environments, connections and services |
| **FileOnQ administrator** | Supports the integration and test environment |
| **CORs / field approvers** | Receiving and acceptance, unchanged |

## 5. Operating flow

### 5.1 Intake
The intake service checks the mailbox on a schedule. It records every email and attachment, identifies invoices versus other documents (statements, past-due notices, supporting documents), and splits files that hold more than one invoice. Non-invoice items go to a separate list for a technician to handle.

### 5.2 Extraction and validation
- For each invoice, the service extracts the agreed data fields and records where on the page each value was found.
- It then runs the validation checklist:
  - **Required elements**, as agreed with ICE in Phase 0. Expected to align with the proper-invoice elements in FAR 32.905(b) plus ICE- or contract-specific items.
  - **Arithmetic**: line items add up to the total.
  - **Formats and dates.**
  - **Duplicates.**
- Each failed check produces a specific reason.

### 5.3 Confidence and status
Each field gets a confidence score, and each invoice gets one of three statuses:
- **Ready for review:** all required elements found with high confidence, and all checks pass.
- **Needs attention:** one or more fields have low confidence or a check needs judgment.
- **Likely improper:** required elements are missing or checks fail.

The confidence cutoffs are set by ICE from measured results (§8), not fixed in advance.

### 5.4 Technician review
The technician sees the invoice beside the extracted data, with low-confidence fields and failed checks highlighted, and clicking a field shows where it came from on the page. The technician can do one of three things:
- **Approve:** the system creates the FileOnQ record with the PDF attached.
- **Correct, then approve:** each change is logged with the old and new value.
- **Reject** with a reason code: the system drafts a vendor notice listing the missing or incorrect elements, which the technician reviews and sends.

### 5.5 Handoff
After approval, the record follows ICE's existing FileOnQ workflow to field approval, the financial system and Treasury payment.

## 6. Human oversight and decision rights

- **Every record is reviewed by a technician** in the prototype, the pilot, and at the start of production.
- Any later change, such as lighter review for invoice types with consistently proven accuracy, is **an ICE decision** made by the executive sponsors on measured results. It is never a default setting.
- The system does not send email to vendors, approve payments, or change records after approval.

## 7. Exceptions and rejections

| Situation | Handling |
|---|---|
| Required element missing | Status "Likely improper". Technician confirms and rejects with a reason code. Notice drafted |
| Arithmetic or format failure | Status "Needs attention". Technician corrects or rejects |
| Possible duplicate | Flagged with a link to the earlier invoice. Technician decides |
| Non-invoice document | Routed to the technician's non-invoice list |
| Unreadable or corrupt file | Routed to the technician with the reason |
| System unavailable | Technicians revert to the current manual process. The mailbox is unchanged, so no invoices are lost |

The rejection timing and notice format will follow ICE's procedures and the Prompt Payment rules. These are to be confirmed in Phase 0.

## 8. Measurement and improvement

**Measures, reported weekly in the pilot:**
- field-level accuracy
- the rate of invoices marked Ready that turn out to contain an error (the key safety measure)
- the share of invoices reaching Ready
- technician minutes per invoice
- improper-invoice detection rate
- corrections by field and by vendor

**Improvement process.** Technician corrections are captured as labeled examples. On a regular cycle, the team reviews where errors cluster, adjusts the extraction and validation, re-tests on a held-out set, and releases changes only after the process owner approves. The system does not change its own behavior without that review.

## 9. Integration and future direction

- **FileOnQ.**
  - Prototype: a mock interface produces FileOnQ-ready records.
  - Pilot: the integration method (an API, bulk import, or the existing OFM automation) is chosen from what Phase 0 finds.
- **Separation from the destination system.** The intake service connects to the destination system through a separate interface layer. If ICE moves to SAP S/4HANA, or later routes invoices directly to its financial system instead of through FileOnQ, the intake steps stay the same and only that layer changes.

## 10. Security, privacy and records

**Prototype:**
- synthetic invoices only, in a Guidehouse-provided environment
- no connection to ICE systems
- no personal or financial data

**Pilot and production:**
- an ICE-authorized environment and FedRAMP-authorized services only
- ICE single sign-on, with role-based access (technician, lead, auditor)
- protection of taxpayer identification numbers and banking data that appear on invoices
- connections approved by the CIO's office

**Audit log.** The log is server-side and append-only. It records every email received, every extraction, every edit with old and new values, every decision, the user and the time. It cannot be reset or edited from the user interface. Auditors get read-only access.

**Records.** Retention of invoice images and the audit log follows ICE's records schedule.

## 11. Operating modes by phase

| Mode | Data | Systems | Technician role |
|---|---|---|---|
| Prototype | Synthetic invoices | Test mailbox; mock FileOnQ | Timed evaluation sessions |
| Pilot (shadow mode) | Live invoices, in an authorized environment | Read-only mailbox access; FileOnQ integration if feasible | Technicians work as today; system results are compared with theirs |
| Pilot (assisted) | Live invoices | As above | Technicians work from the review queue |
| Production | Live invoices | Approved integrations | Review queue; any reduced-review rules only by ICE decision |
