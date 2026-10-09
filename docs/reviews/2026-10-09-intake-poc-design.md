# Design: AP invoice intake proof of concept (internal)

Prepared October 9, 2026. Internal. Builds on [the Oct 5 demo review](2026-10-05-client-demo-review-and-poc-scope.md) (§ numbers below refer to it) and [the deal package next steps](2026-10-06-deal-package-next-steps.md). Timestamps are from the Oct 5 transcript.

## 1. Why build it now

David asked for a "project plan, concept of ops … and then a bill" (38:53). Those documents rest on assumptions because discovery waits for a contract. A working proof of concept on synthetic data lets us replace some of those assumptions with evidence before the package goes out:

| Package item | What the proof of concept gives it |
|---|---|
| D4, synthetic test set | The set itself, with ground truth |
| D5, working prototype | A tested shape for the flow, the review screen and the record interface |
| D7, metrics report | The report format, filled with real (synthetic-data) numbers |
| B6, PoC definition and success criteria | Metrics that are known to be computable |
| CONOPS §5.4, technician review | Screens to describe |
| Estimate, Phase 1 labor (720 base hours) | Actual effort to build, to compare against the estimate |

It is **internal evidence**, not a client demo. The next-steps document advises against a refreshed demo before the package is out (B1 to B5), and nothing here changes that. It involves no ICE contact, data or systems, so it is not discovery.

## 2. Scope

Laurie's quick win (25:02), end to end, on synthetic data:

1. Synthetic vendor emails (`.eml`) land in a local inbox folder.
2. **Ingest:** attachments are pulled out; each document is classified as invoice or not; PDFs holding several invoices are split.
3. **Extract:** invoice fields are read from the PDF's text layer and word positions, using label variants, position and value type. There are no per-vendor templates.
4. **Validate:** a configurable checklist runs: required elements (a draft based on FAR 32.905(b), labelled as a draft until ICE supplies its own), line items adding to the total, date and format checks, and duplicates. Each failed check has a reason code.
5. **Score and route:** each field gets a confidence derived from visible factors (§5). Each invoice gets a status: *Ready for review*, *Needs attention* or *Likely improper*.
6. **Review** (increment b): the technician sees the PDF beside the fields, with each value's source highlighted, and approves, corrects or rejects with a reason code. A rejection drafts a vendor notice, which is never sent.
7. **Record:** on approval, a **mock** FileOnQ adapter writes a record (our fields, the PDF, a returned record ID).
8. **Audit:** every step above appends to an insert-only event log.
9. **Measure:** a metrics report compares results with ground truth.

**Out of scope:** scanned or image-only invoices (no OCR yet; see §7), a real mailbox, any ICE system, COR approval, the financial system, Treasury, S/4HANA, and deployment to a cloud platform.

## 3. Platform

ICE's platform will be **Databricks or Azure, depending on what is available in ICE's cloud environment**. That is a Phase 0 question. The proof of concept runs locally with no cloud credentials and keeps three pieces behind interfaces, so moving it means writing one adapter per piece, not rewriting the pipeline:

| Piece | Local (now) | Databricks (later) | Azure (later) |
|---|---|---|---|
| Storage and audit log | SQLite and files | Tables and file volumes in the workspace | A managed database and blob storage |
| Field extraction | PDF text layer with layout rules | A model served in the workspace | A document-AI invoice service or a hosted model |
| Review screen | Small Python web app | A Python app hosted in the workspace | A hosted Python web app |

Which specific services ICE's authorization covers, and at what impact level, is unverified. Nothing in this design assumes a particular service is authorized.

## 4. Components

All code is Python 3.12 under `poc/intake/`. Each pipeline stage is a plain function that takes and returns records, so it can later run as a job step on either platform.

| Module | Purpose | Depends on |
|---|---|---|
| `synth/` | Generates the synthetic emails, PDFs and ground truth. Layout templates live here and **only** here | PyMuPDF |
| `intake/ingest.py` | Reads `.eml` files, saves attachments, records email-to-document links | standard library `email` |
| `intake/classify.py` | Invoice or not; splits multi-invoice PDFs | PyMuPDF text |
| `intake/extract/` | `Extractor` interface; `textlayer.py` is the local implementation | PyMuPDF words and positions |
| `intake/validate.py` | Runs the checklist from `config/checklist.yaml`; returns pass/fail with reason codes | — |
| `intake/score.py` | Field confidence and invoice status from thresholds in `config/thresholds.yaml` | — |
| `intake/store.py` | `Store` interface; SQLite implementation; insert-only event table | `sqlite3` |
| `intake/record.py` | `SystemOfRecord` interface; `MockFileOnQ` implementation | — |
| `intake/evaluate.py` | Metrics against ground truth; writes the report | — |
| `app/` (increment b) | Review screen | Flask |
| `tests/` | pytest | — |

**The `SystemOfRecord` interface defines our own record:** the extracted fields, the PDF and a returned record ID. It makes no assumptions about FileOnQ's API, field names or import formats (§9 of the demo review lists these as questions for ICE).

## 5. Confidence

Field confidence is computed from factors the reviewer can see. It is never hard-coded and never random:

- **Label match:** whether the value sits beside a recognised label, and how specific the label is.
- **Format fit:** whether the value parses as the expected type (date, amount, identifier pattern).
- **Agreement:** whether independent methods (label proximity, position on the page, cross-checks such as line items summing to the total) give the same value.
- **Competition:** how far ahead the chosen candidate is of the next best one.

The weights are configuration, not code. The report checks **calibration**: of the fields scored around 90%, about how many are actually right. Invoice status then follows the checklist outcome and the lowest required-field confidence against the thresholds.

## 6. Synthetic data

- **Vendors are fictional only**, from Microsoft's published fictitious-company list (as in this repo's `src/utils/demoIdentities.ts`), checked against the real-company list in `tests/vendorNames.test.ts`.
- **Ten layouts**, varying field positions, label wording ("Invoice No." / "Inv #" / "Bill Number"), date formats, and one-page versus multi-page line items. **Three layouts are held out** from all extraction development and tuning.
- **Edge cases:**
  - a missing required element
  - line items that don't add up to the total
  - a duplicate invoice
  - a credit memo
  - several invoices in one PDF
  - an invoice plus a supporting document in one email
  - a non-invoice email (statement or past-due notice)
- **Identifiers are fake by construction.** Tax-ID-like and bank-like fields use patterns that cannot be valid.
- **Size:** about 150 documents, split into a development set and a held-out test set. The PDFs are small and are committed with their ground-truth JSON.

## 7. Keeping the results honest

- **The generator and the extractor are kept apart.** Layout templates are written in `synth/` only. The extractor never reads them, and the held-out layouts are never used to tune it.
- **Every number is labelled** "synthetic, born-digital PDFs: an upper bound, not a forecast for ICE's invoices." The label is part of the report template, not left to whoever presents it.
- **The report breaks results down** by field, by seen versus held-out layout, and by edge case. It gives no single headline accuracy.
- **Known gaps, stated in the report:**
  - **No scanned invoices** until an OCR or model-based extractor is plugged into the same interface.
  - **No reviewer-minutes figure.** That needs timed sessions with ICE technicians (Phase 2).
- The rate of invoices marked Ready that actually contain an error or are improper is the **gating metric**, as in the demo review §8.4.

## 8. Metrics (the D7 report)

| Metric | Definition |
|---|---|
| Field accuracy | Share of fields exactly right after normalisation, per field, seen versus held-out layouts |
| Ready share | Share of invoices routed *Ready for review* |
| False-ready rate (gating) | Share of *Ready* invoices that contain an extraction error or are improper |
| Improper-invoice detection | Precision and recall of *Likely improper* against ground truth |
| Calibration | Accuracy within each confidence band |
| Classification and splitting | Accuracy of invoice / not-invoice and of multi-invoice splits |
| Correction rate per field | From review events (increment b) |

## 9. Audit log

Every ingestion, extraction, check result, status, edit (old and new value), decision and record creation is appended to an event table with a user and a time. Locally the table is insert-only: database triggers reject updates and deletes, and no screen offers a reset. This is the direct fix for the "immutable audit log" claim made about the demo (§7.1, item 1). On either platform the same table becomes an append-only table with platform access controls.

## 10. Increments

| Increment | Contents | Done when |
|---|---|---|
| **(a)** | Synthetic set, ingest, classify, extract, validate, score, mock record, audit log, metrics report, tests | `pytest` passes; the report runs on the held-out set; committed and pushed |
| **(b)** | Review screen: queue, PDF beside fields with source highlighting, approve / correct / reject, drafted notice, correction capture | Tested by script; committed and pushed |

Increment (a) alone delivers D4, the D7 format and B6.

## 11. Effort record

Build effort is logged in `poc/intake/EFFORT.md` (start and end of each increment) so pricing can compare it with the 720-hour Phase 1 base. The comparison needs care: the proof of concept leaves out work the funded Phase 1 includes, such as ICE's checklist, layouts informed by discovery, environment setup in ICE's cloud and security documentation.

## 12. Assumptions

| # | Assumption |
|---|---|
| P1 | ICE's platform will be Databricks or Azure. Which one, and which services are authorized, is confirmed in Phase 0 |
| P2 | A FAR 32.905(b)-based checklist is a reasonable stand-in until ICE provides its own |
| P3 | Born-digital PDFs are a useful first test. ICE's share of scanned invoices is unknown (demo review §10, question 3) |
| P4 | Ten synthetic layouts are enough to show whether extraction holds up on unseen layouts. They do not represent ICE's real vendor mix |

## 13. Rules carried over

- No "learns as it goes", "self-learning", "reinforcement learning", "immutable audit log", "very easily", "free", or "written or vetted by DoD" anywhere, including the user interface.
- No accuracy or headcount promises. Measured results are labelled as synthetic.
- No invented FileOnQ details, ICE facts, volumes, rates or dollar figures.
- No real company names and no real identifiers.
