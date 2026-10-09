# AP Invoice Intake Proof of Concept: Implementation Plan

> Steps use checkbox (`- [ ]`) syntax for tracking. Execute task by task; run the tests at each step.

**Goal:** Build a local, platform-neutral proof of concept of ICE AP invoice intake (mailbox → validated record with the PDF attached), measured against synthetic ground truth, to inform the plan, CONOPS and estimate.

**Architecture:** A Python package under `poc/intake/`. Pipeline stages are plain functions over dataclass records: ingest → classify/split → extract → validate → score. Storage, extraction and the system of record sit behind interfaces (`Store`, `Extractor`, `SystemOfRecord`) so each can be swapped for a Databricks or Azure adapter later. A separate `synth` package generates the synthetic emails, PDFs and ground truth. Increment (b) adds a Flask review screen.

**Tech Stack:** Python 3.12, PyMuPDF 1.28 (`import pymupdf`), PyYAML 6, Flask 3, SQLite (standard library), pytest 8.

**Spec:** `docs/reviews/2026-10-09-intake-poc-design.md`

## Global Constraints

- All code lives under `poc/intake/`. No change to the reconciliation app (`src/`, `public/`, `tests/`).
- The `intake` package must never import `synth` (enforced by a test). The three held-out layouts (`L08`, `L09`, `L10`) are never used to tune extraction.
- Vendors are fictional only (Microsoft's fictitious-company list). TINs start with `00-`; phones use `555-01NN`; contract numbers start with `SYN-`.
- Never write: "learns as it goes", "self-learning", "reinforcement learning", "immutable audit log", "very easily", "free", "written or vetted by DoD". No accuracy or headcount promises.
- No invented FileOnQ API details. The mock defines our own record shape and is labelled MOCK wherever it appears.
- Every metrics report starts with: "Synthetic data, born-digital PDFs only. These results are an upper bound, not a forecast for ICE's invoices."
- Every app page carries the banner: "Synthetic data — illustrative. FileOnQ is a mock."
- Confidence is computed from visible factors; never hard-coded or random.
- The checklist is labelled a draft based on FAR 32.905(b) until ICE supplies its own.
- Commit subjects are plain imperative sentences with no type prefix and no AI attribution. Commit only to `claude/demo-review-poc-scope-okucbe`.

## Review Focus

1. **A scanned (image-only) PDF** must route to *Needs attention* with reason `UNREADABLE` ("no text layer"), not crash and not reach *Ready* (test in Task 3).
2. **A corrupt or non-PDF attachment** must be recorded as unreadable with a reason while the rest of the email is processed (test in Task 3).
3. **Re-running the pipeline on the same inbox** must not duplicate documents or events, and an invoice must never be flagged as a duplicate of itself (test in Task 7).
4. **Amounts in the forms people actually write** ("$1,234.56", "1,234.56 USD", "(1,234.56)", "-1,234.56") must parse to the right signed value (test in Task 1).
5. **A technician approving twice, or approving an invoice with a missing required element**, must be refused with a clear reason (test in Task 9).

---

## File map

```
poc/intake/
  pyproject.toml          package metadata, pytest config
  README.md               what it is, how to run, honesty labels, platform mapping
  EFFORT.md               build time log
  .gitignore              out/
  config/checklist.yaml   draft required elements and check settings
  config/thresholds.yaml  confidence weights and the Ready threshold
  intake/__init__.py
  intake/models.py        dataclasses and status constants
  intake/normalize.py     amount, date, id and text parsing
  intake/config.py        load_config
  intake/ingest.py        read .eml, save attachments
  intake/classify.py      invoice / credit memo / other / unreadable; split PDFs
  intake/extract/__init__.py
  intake/extract/base.py      Extractor protocol
  intake/extract/lexicon.py   label vocabulary
  intake/extract/layout.py    text segments and rows from a PDF page
  intake/extract/textlayer.py TextLayerExtractor
  intake/validate.py      run_checks
  intake/score.py         assess
  intake/store.py         Store protocol, SqliteStore (append-only events)
  intake/record.py        IntakeRecord, SystemOfRecord, MockFileOnQ
  intake/pipeline.py      run
  intake/evaluate.py      metrics against ground truth, report writer
  intake/review.py        correct / approve / reject, drafted notice   (increment b)
  intake/cli.py           run, evaluate
  synth/__init__.py
  synth/vendors.py        fictional vendors
  synth/styles.py         ten layout styles (L08-L10 held out)
  synth/spec.py           InvoiceSpec, money formatting
  synth/render.py         draw invoices, statements, packing slips
  synth/generate.py       compose emails and ground truth for dev and heldout
  app/__init__.py         Flask app factory                              (increment b)
  app/templates/*.html
  data/dev/{inbox,truth}/       generated, committed
  data/heldout/{inbox,truth}/   generated, committed
  reports/dev.md, reports/heldout.md   generated, committed
  tests/test_*.py
```

All commands below run from `poc/intake/` unless stated.

---

## Increment (a)

### Task 1: Scaffold, models and normalisation

**Files:**
- Create: `poc/intake/pyproject.toml`, `poc/intake/.gitignore`, `poc/intake/EFFORT.md`, `poc/intake/intake/__init__.py`, `poc/intake/intake/models.py`, `poc/intake/intake/normalize.py`
- Test: `poc/intake/tests/test_normalize.py`

**Interfaces:**
- Produces: `parse_amount(s) -> float | None`, `fmt_amount(x) -> str`, `parse_date(s) -> str | None` (ISO), `norm_id(s) -> str`, `norm_text(s) -> str`, `compare_key(field, value) -> str | None`; dataclasses `Attachment, Email, Document, FieldValue, LineItem, Extraction, CheckResult, Assessment`; constants `READY, ATTENTION, IMPROPER`, `HEADER_FIELDS`, `FIELD_TYPES`; `to_json(obj)`, `extraction_from_dict`, `document_from_dict`, `assessment_from_dict`.

- [ ] **Step 1: Write the scaffold files**

`pyproject.toml`:
```toml
[project]
name = "intake-poc"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["pymupdf>=1.24", "pyyaml>=6", "flask>=3"]

[project.optional-dependencies]
test = ["pytest>=8"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

`.gitignore`:
```
out/
__pycache__/
.pytest_cache/
```

`EFFORT.md`:
```markdown
# Build effort log

Wall-clock time spent building the proof of concept, for comparison with the Phase 1 estimate (720 base hours). Not like for like: see the design doc §11.

| Date | Start | End | Hours | Work |
|---|---|---|---|---|
| 2026-10-09 | 12:12 | | | Design, plan, increment (a) |
```

`intake/__init__.py`: empty.

- [ ] **Step 2: Write the failing tests**

`tests/test_normalize.py`:
```python
import pytest
from intake.normalize import parse_amount, parse_date, norm_id, norm_text, compare_key

@pytest.mark.parametrize("s,expected", [
    ("$1,234.56", 1234.56), ("1,234.56 USD", 1234.56), ("(1,234.56)", -1234.56),
    ("-1,234.56", -1234.56), ("($12.00)", -12.0), ("Total: $99.10", 99.10),
    ("-12.00 USD", -12.0), ("1234.5", None), ("abc", None), ("", None), (None, None),
])
def test_parse_amount(s, expected):
    assert parse_amount(s) == expected

@pytest.mark.parametrize("s,expected", [
    ("2026-09-14", "2026-09-14"), ("09/14/2026", "2026-09-14"), ("09/14/26", "2026-09-14"),
    ("September 14, 2026", "2026-09-14"), ("Sep 14, 2026", "2026-09-14"),
    ("14-Sep-2026", "2026-09-14"), ("14 September 2026", "2026-09-14"),
    ("Issued 09/14/2026 by", "2026-09-14"), ("not a date", None), (None, None),
])
def test_parse_date(s, expected):
    assert parse_date(s) == expected

def test_norm_id_and_text():
    assert norm_id(" cf-10233 ") == "CF10233"
    assert norm_text("PO Box 1001,  Springfield") == "po box 1001 springfield"

def test_compare_key_by_type():
    assert compare_key("total", "$1,000.00") == compare_key("total", "1000.00")
    assert compare_key("invoice_date", "09/14/2026") == "2026-09-14"
    assert compare_key("contract_number", "syn-26-c-01234") == "SYN26C01234"
    assert compare_key("vendor_name", None) is None
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `python -m pytest tests/test_normalize.py -q`
Expected: errors with `ModuleNotFoundError: No module named 'intake.normalize'`.

- [ ] **Step 4: Write `intake/models.py`**

```python
"""Records passed between pipeline stages. Plain dataclasses, JSON-serialisable."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field, is_dataclass

READY = "ready"
ATTENTION = "needs_attention"
IMPROPER = "likely_improper"
STATUS_LABELS = {READY: "Ready for review", ATTENTION: "Needs attention", IMPROPER: "Likely improper"}

HEADER_FIELDS = (
    "vendor_name", "invoice_number", "invoice_date", "contract_number",
    "payment_terms", "remit_to", "contact", "tin", "total",
)
FIELD_TYPES = {
    "vendor_name": "text", "invoice_number": "id", "invoice_date": "date",
    "contract_number": "id", "payment_terms": "text", "remit_to": "text",
    "contact": "text", "tin": "id", "total": "amount", "subtotal": "amount", "tax": "amount",
}


@dataclass
class Attachment:
    email_id: str
    index: int
    filename: str
    path: str
    sha256: str


@dataclass
class Email:
    email_id: str
    sender: str
    subject: str
    received: str
    attachments: list[Attachment]


@dataclass
class Document:
    doc_id: str
    email_id: str
    attachment_index: int
    filename: str
    path: str
    file_sha256: str
    pages: list[int]          # 1-based page numbers in the attachment
    kind: str                 # invoice | credit_memo | other | unreadable
    note: str = ""


@dataclass
class FieldValue:
    name: str
    value: str | None
    page: int | None = None
    bbox: tuple[float, float, float, float] | None = None
    confidence: float = 0.0
    factors: dict[str, float] = field(default_factory=dict)


@dataclass
class LineItem:
    description: str
    quantity: float | None
    unit_price: float | None
    amount: float | None


@dataclass
class Extraction:
    doc_id: str
    extractor: str
    fields: dict[str, FieldValue]
    line_items: list[LineItem]
    has_text: bool = True

    def value(self, name: str) -> str | None:
        f = self.fields.get(name)
        return f.value if f else None


@dataclass
class CheckResult:
    code: str
    passed: bool
    message: str
    field: str | None = None


@dataclass
class Assessment:
    doc_id: str
    status: str
    checks: list[CheckResult]
    min_required_confidence: float

    @property
    def failed(self) -> list[CheckResult]:
        return [c for c in self.checks if not c.passed]


def to_json(obj) -> str:
    return json.dumps(asdict(obj) if is_dataclass(obj) else obj, sort_keys=True)


def document_from_dict(d: dict) -> Document:
    return Document(**d)


def extraction_from_dict(d: dict) -> Extraction:
    fields = {
        k: FieldValue(**{**v, "bbox": tuple(v["bbox"]) if v.get("bbox") else None})
        for k, v in d["fields"].items()
    }
    return Extraction(
        doc_id=d["doc_id"], extractor=d["extractor"], fields=fields,
        line_items=[LineItem(**li) for li in d["line_items"]], has_text=d.get("has_text", True),
    )


def assessment_from_dict(d: dict) -> Assessment:
    return Assessment(
        doc_id=d["doc_id"], status=d["status"],
        checks=[CheckResult(**c) for c in d["checks"]],
        min_required_confidence=d["min_required_confidence"],
    )
```

- [ ] **Step 5: Write `intake/normalize.py`**

```python
"""Parsing and normalisation shared by extraction, validation and evaluation."""
from __future__ import annotations

import re
from datetime import datetime

from .models import FIELD_TYPES

_AMOUNT = re.compile(
    r"(?P<open>\()?\s*(?P<neg>-)?\s*\$?\s*(?P<num>\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})\s*(?P<close>\))?(?:\s*USD)?",
    re.I,
)
_DATE_FORMATS = ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%B %d, %Y", "%b %d, %Y", "%d-%b-%Y", "%d %B %Y", "%d %b %Y")
_DATE_SEARCH = re.compile(
    r"\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4}|[A-Za-z]{3,9}\.? \d{1,2}, \d{4}|\d{1,2}-[A-Za-z]{3}-\d{4}|\d{1,2} [A-Za-z]{3,9} \d{4}"
)


def parse_amount(s: str | None) -> float | None:
    if not s:
        return None
    m = _AMOUNT.search(s)
    if not m:
        return None
    value = float(m.group("num").replace(",", ""))
    if m.group("neg") or (m.group("open") and m.group("close")):
        value = -value
    return round(value, 2)


def fmt_amount(x: float) -> str:
    return f"{x:.2f}"


def _try_formats(s: str) -> str | None:
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_date(s: str | None) -> str | None:
    if not s:
        return None
    s = s.strip()
    found = _try_formats(s)
    if found:
        return found
    for m in _DATE_SEARCH.finditer(s):
        found = _try_formats(m.group(0).replace(".", ""))
        if found:
            return found
    return None


def norm_id(s: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", s.upper())


def norm_text(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def compare_key(field: str, value: str | float | None) -> str | None:
    """Canonical form used to compare an extracted value with ground truth."""
    if value is None or value == "":
        return None
    kind = FIELD_TYPES.get(field, "text")
    if kind == "amount":
        x = value if isinstance(value, float) else parse_amount(str(value))
        return None if x is None else fmt_amount(x)
    if kind == "date":
        return parse_date(str(value))
    if kind == "id":
        return norm_id(str(value))
    return norm_text(str(value))
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `python -m pytest tests/test_normalize.py -q`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add poc/intake
git commit -m "Scaffold the intake proof of concept with records and parsing"
```

---

### Task 2: Synthetic emails, invoices and ground truth

**Files:**
- Create: `poc/intake/synth/__init__.py` (empty), `synth/vendors.py`, `synth/styles.py`, `synth/spec.py`, `synth/render.py`, `synth/generate.py`
- Create (generated): `poc/intake/data/{dev,heldout}/{inbox,truth}/`
- Test: `poc/intake/tests/test_synth.py`

**Interfaces:**
- Produces: `VENDORS: list[Vendor]`; `STYLES: list[LayoutStyle]` (`layout_id`, `held_out`); `InvoiceSpec`, `Line`; `render_invoice(doc, inv, style) -> list[int]`, `render_statement(...)`, `render_packing_slip(...)`; `build_set(name, out_dir) -> list[dict]` (truth records); CLI `python -m synth.generate --out data`.
- Truth JSON per email: `{email_id, layout_id, held_out, subject, attachments: [{index, filename, documents: [{doc_id, pages, kind, expected_status, expected_codes, fields, line_items}]}]}`. `doc_id` is `f"{email_id}-{index}-{first_page}"`, the same scheme the pipeline uses.

- [ ] **Step 1: Write the failing tests**

`tests/test_synth.py`:
```python
import json
import re
from pathlib import Path

import pymupdf
import pytest

from synth.generate import build_set
from synth.styles import STYLES
from synth.vendors import VENDORS

REAL_COMPANIES = ["L3Harris", "BAE Systems", "General Dynamics", "Booz Allen", "ManTech", "Northrop",
                  "SAIC", "CACI", "Leidos", "Raytheon", "Lockheed", "Honeywell", "Boeing", "Accenture",
                  "Deloitte", "Guidehouse", "Microsoft", "Amazon", "Google"]


@pytest.fixture(scope="module")
def dev(tmp_path_factory):
    out = tmp_path_factory.mktemp("synth")
    return out, build_set("dev", out)


def test_layouts_split_seven_dev_three_held_out():
    assert sorted(s.layout_id for s in STYLES if s.held_out) == ["L08", "L09", "L10"]
    assert len([s for s in STYLES if not s.held_out]) == 7


def test_vendors_fictional_and_identifiers_invalid():
    for v in VENDORS:
        assert not any(real.lower() in v.name.lower() for real in REAL_COMPANIES)
        assert v.tin.startswith("00-")
        assert re.search(r"555-01\d\d", v.contact)


def test_build_is_deterministic(tmp_path):
    a = build_set("heldout", tmp_path / "a")
    b = build_set("heldout", tmp_path / "b")
    assert a == b


def test_dev_set_uses_only_dev_layouts_and_has_edge_cases(dev):
    _, truth = dev
    assert all(not t["held_out"] for t in truth)
    docs = [d for t in truth for a in t["attachments"] for d in a["documents"]]
    codes = {c for d in docs for c in d["expected_codes"]}
    assert {"MISSING_CONTRACT_NUMBER", "ARITH_TOTAL", "DUPLICATE", "CREDIT_MEMO"} <= codes
    kinds = {d["kind"] for d in docs}
    assert {"invoice", "credit_memo", "other"} <= kinds
    assert any(len(a["documents"]) == 2 for t in truth for a in t["attachments"])  # multi-invoice PDF
    assert any(len(d["pages"]) > 1 for d in docs)                                   # multi-page invoice
    assert 80 <= sum(d["kind"] in ("invoice", "credit_memo") for d in docs) <= 110


def test_truth_values_appear_in_the_rendered_pdf(dev):
    out, truth = dev
    t = truth[0]
    att = t["attachments"][0]
    doc = att["documents"][0]
    assert (out / "inbox" / f"{t['email_id']}.eml").exists()
    pdf_path = out / "pdf" / t["email_id"] / att["filename"]
    text = "".join(p.get_text() for p in pymupdf.open(pdf_path))
    assert doc["fields"]["invoice_number"] in text
    assert doc["fields"]["contract_number"] in text
    assert doc["fields"]["vendor_name"] in text


def test_truth_files_written(dev):
    out, truth = dev
    for t in truth:
        saved = json.loads((out / "truth" / f"{t['email_id']}.json").read_text())
        assert saved == t
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `python -m pytest tests/test_synth.py -q`
Expected: `ModuleNotFoundError: No module named 'synth.generate'`.

- [ ] **Step 3: Write `synth/vendors.py`**

```python
"""Fictional vendors for the synthetic invoice set.

Names come from Microsoft's published list of fictitious companies, the same
source as src/utils/demoIdentities.ts. Identifiers are invalid by construction:
TINs start with 00 (not an issued EIN prefix), phone numbers use the 555-0100
to 555-0199 range reserved for fiction, and contract numbers start with SYN.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Vendor:
    name: str
    street: str
    city: str
    domain: str
    remit_name: str
    remit_street: str
    remit_city: str
    tin: str
    contact: str
    inv_prefix: str


def _v(i, name, slug, contact, prefix):
    return Vendor(
        name=name, street=f"{100 + i * 37} Sample Parkway", city="Springfield, VA 20000",
        domain=f"{slug}.example", remit_name=name, remit_street=f"PO Box {1000 + i}",
        remit_city="Fairview, VA 20100", tin=f"00-{1000001 + i * 7919:07d}",
        contact=f"{contact}, (703) 555-01{i + 1:02d}", inv_prefix=prefix,
    )


VENDORS = [
    _v(0, "Contoso Facility Services", "contoso-facility", "Jordan Lee", "CF-"),
    _v(1, "Fabrikam Logistics", "fabrikam-logistics", "Casey Morgan", "FL"),
    _v(2, "Northwind Traders", "northwind", "Riley Chen", "NW-"),
    _v(3, "Tailspin Aviation Services", "tailspin", "Avery Patel", "TS"),
    _v(4, "Litware Software", "litware", "Taylor Brooks", "LW-"),
    _v(5, "Proseware Analytics", "proseware", "Morgan Diaz", "PA"),
    _v(6, "Fourth Coffee Catering", "fourthcoffee", "Jamie Rivera", "FC-"),
    _v(7, "Wide World Importers", "wideworld", "Quinn Foster", "WWI"),
    _v(8, "Trey Research", "treyresearch", "Drew Kim", "TR-"),
    _v(9, "Lucerne Publishing", "lucerne", "Skyler Hayes", "LP"),
    _v(10, "Adventure Works Outfitters", "adventureworks", "Reese Carter", "AW-"),
    _v(11, "Adatum Consulting", "adatum", "Parker Gray", "AD"),
]

SERVICES = [
    "Janitorial services, Building A", "Monthly software maintenance", "Freight, ground",
    "Catering, staff training", "Data analysis support (hours)", "Printing, training manuals",
    "Office supplies", "Equipment rental", "Consulting support (hours)", "Courier deliveries",
    "Records scanning (boxes)", "Help desk support (hours)",
]
```

- [ ] **Step 4: Write `synth/styles.py`**

```python
"""Ten invoice layouts. L08 to L10 are held out from all extraction tuning.

Labels are stored without a trailing colon; the renderer adds one where the
layout puts a label and value on the same row.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class LayoutStyle:
    layout_id: str
    held_out: bool
    font: str
    bold: str
    title: str
    credit_title: str
    vendor_at: str                     # left | right | center
    meta_at: tuple[float, float]
    label_mode: str                    # inline | above
    bill_at: tuple[float, float]
    labels: dict
    date_fmt: str
    money: str                         # dollar | plain | usd
    columns: tuple[str, ...]           # order of desc, qty, unit, amount
    col_titles: dict
    remit_at: str                      # after_totals | mid | footer
    remit_mid_at: tuple[float, float]
    ids_at: str                        # header | footer
    repeat_header: bool
    table_y: float = 270


def _labels(**kw):
    return kw


STYLES = [
    LayoutStyle("L01", False, "helv", "hebo", "INVOICE", "CREDIT MEMO", "left", (360, 80), "inline", (40, 150),
                _labels(invoice_number="Invoice No.", invoice_date="Invoice Date", contract_number="Contract No.",
                        payment_terms="Terms", total="Total Due", subtotal="Subtotal", tax="Tax",
                        remit_to="Remit To", tin="TIN", contact="Contact"),
                "%m/%d/%Y", "dollar", ("desc", "qty", "unit", "amount"),
                dict(desc="Description", qty="Qty", unit="Unit Price", amount="Amount"),
                "after_totals", (0, 0), "footer", True),
    LayoutStyle("L02", False, "tiro", "tibo", "Invoice", "Credit Memo", "right", (40, 110), "above", (40, 150),
                _labels(invoice_number="Invoice Number", invoice_date="Date of Invoice",
                        contract_number="Purchase Order No.", payment_terms="Payment Terms", total="Amount Due",
                        subtotal="Sub-total", tax="Sales Tax", remit_to="Remit Payment To", tin="Tax ID No.",
                        contact="Billing Contact"),
                "%B %d, %Y", "plain", ("desc", "unit", "qty", "amount"),
                dict(desc="Service", unit="Rate", qty="Hours", amount="Line Total"),
                "mid", (330, 150), "header", False),
    LayoutStyle("L03", False, "cour", "cobo", "INVOICE", "CREDIT MEMO", "center", (330, 120), "inline", (40, 120),
                _labels(invoice_number="Inv #", invoice_date="Invoice Date", contract_number="Order No.",
                        payment_terms="Terms", total="Balance Due", subtotal="Subtotal", tax="Tax",
                        remit_to="Send Payment To", tin="EIN", contact="Questions? Contact"),
                "%Y-%m-%d", "usd", ("desc", "qty", "unit", "amount"),
                dict(desc="Description", qty="Quantity", unit="Unit Cost", amount="Extended"),
                "after_totals", (0, 0), "footer", True),
    LayoutStyle("L04", False, "helv", "hebo", "INVOICE", "CREDIT MEMO", "left", (360, 80), "inline", (40, 160),
                _labels(invoice_number="Invoice No.", invoice_date="Invoice Date", contract_number="Contract Number",
                        payment_terms="Payment Terms", total="Grand Total", subtotal="Subtotal", tax="Tax",
                        remit_to="Remit To", tin="Federal Tax ID", contact="Contact"),
                "%d-%b-%Y", "dollar", ("qty", "desc", "unit", "amount"),
                dict(qty="Qty", desc="Description", unit="Unit Price", amount="Amount"),
                "footer", (0, 0), "header", True),
    LayoutStyle("L05", False, "tiro", "tibo", "INVOICE", "CREDIT MEMO", "left", (40, 140), "inline", (330, 140),
                _labels(invoice_number="Invoice Num.", invoice_date="Invoice Date", contract_number="Task Order",
                        payment_terms="Terms", total="Total Amount Due", subtotal="Subtotal", tax="Tax",
                        remit_to="Mail Payment To", tin="TIN", contact="Billing Contact"),
                "%b %d, %Y", "dollar", ("desc", "qty", "unit", "amount"),
                dict(desc="Item", qty="Qty", unit="Price", amount="Amount"),
                "after_totals", (0, 0), "footer", False),
    LayoutStyle("L06", False, "cour", "cobo", "Invoice", "Credit Memo", "right", (40, 110), "above", (40, 150),
                _labels(invoice_number="Invoice Number", invoice_date="Invoice Date", contract_number="Contract #",
                        payment_terms="Payment Terms", total="Total", subtotal="Subtotal", tax="Tax",
                        remit_to="Remit To", tin="Taxpayer ID", contact="Contact"),
                "%m/%d/%Y", "plain", ("desc", "qty", "unit", "amount"),
                dict(desc="Details", qty="Units", unit="Rate", amount="Total"),
                "mid", (330, 150), "footer", True),
    LayoutStyle("L07", False, "helv", "hebo", "INVOICE", "CREDIT MEMO", "center", (330, 120), "inline", (40, 120),
                _labels(invoice_number="Invoice #", invoice_date="Issued", contract_number="PO Number",
                        payment_terms="Terms", total="Amount Due", subtotal="Subtotal", tax="Tax",
                        remit_to="Pay To", tin="Tax ID", contact="Inquiries"),
                "%B %d, %Y", "usd", ("desc", "qty", "unit", "amount"),
                dict(desc="Description", qty="Hrs", unit="Rate", amount="Amount"),
                "after_totals", (0, 0), "footer", True),
    # Held out from all tuning.
    LayoutStyle("L08", True, "tiro", "tibo", "BILL", "CREDIT MEMO", "left", (360, 80), "inline", (40, 160),
                _labels(invoice_number="Bill Number", invoice_date="Billing Date", contract_number="Agreement No.",
                        payment_terms="Payment Terms", total="Please Pay", subtotal="Net", tax="Tax",
                        remit_to="Payment Address", tin="Taxpayer Identification Number", contact="Customer Service"),
                "%d %B %Y", "dollar", ("desc", "qty", "unit", "amount"),
                dict(desc="Description", qty="Qty", unit="Unit Price", amount="Total"),
                "footer", (0, 0), "header", False),
    LayoutStyle("L09", True, "cour", "cobo", "Invoice for Services", "Credit Memo", "left", (330, 80), "inline",
                (40, 160),
                _labels(invoice_number="Reference #", invoice_date="Invoice Date", contract_number="Award No.",
                        payment_terms="Net Terms", total="Total Due", subtotal="Subtotal", tax="Tax",
                        remit_to="Remit Payment To", tin="TIN", contact="Contact"),
                "%Y-%m-%d", "plain", ("amount", "desc", "qty", "unit"),
                dict(amount="Amount", desc="Description", qty="Qty", unit="Unit Price"),
                "after_totals", (0, 0), "footer", True),
    LayoutStyle("L10", True, "helv", "hebo", "INVOICE", "CREDIT MEMO", "right", (40, 110), "above", (40, 150),
                _labels(invoice_number="No.", invoice_date="Date", contract_number="Contract",
                        payment_terms="Terms", total="TOTAL", subtotal="Sub Total", tax="Sales Tax",
                        remit_to="Remit to", tin="Tax ID #", contact="Contact Person"),
                "%m/%d/%y", "usd", ("desc", "qty", "unit", "amount"),
                dict(desc="Description", qty="Qty", unit="Unit", amount="Amount"),
                "mid", (330, 150), "footer", False),
]
```

- [ ] **Step 5: Write `synth/spec.py`**

```python
from dataclasses import dataclass, field
from datetime import date

from .vendors import Vendor


@dataclass(frozen=True)
class Line:
    description: str
    quantity: float
    unit_price: float


@dataclass
class InvoiceSpec:
    vendor: Vendor
    invoice_number: str
    invoice_date: date
    contract_number: str
    payment_terms: str
    lines: list[Line]
    tax_rate: float
    credit: bool = False
    omit: tuple[str, ...] = ()
    total_delta: float = 0.0
    defects: list[str] = field(default_factory=list)

    def amount(self, line: Line) -> float:
        a = round(line.quantity * line.unit_price, 2)
        return -a if self.credit else a

    @property
    def subtotal(self) -> float:
        return round(sum(self.amount(li) for li in self.lines), 2)

    @property
    def tax(self) -> float:
        return round(self.subtotal * self.tax_rate, 2)

    @property
    def total(self) -> float:
        return round(self.subtotal + self.tax + self.total_delta, 2)

    @property
    def remit_lines(self) -> list[str]:
        v = self.vendor
        return [v.remit_name, v.remit_street, v.remit_city]


def money(x: float, style: str) -> str:
    a = abs(x)
    if style == "dollar":
        s = f"${a:,.2f}"
        return f"({s})" if x < 0 else s
    if style == "plain":
        s = f"{a:,.2f}"
        return f"({s})" if x < 0 else s
    return f"{'-' if x < 0 else ''}{a:,.2f} USD"
```

- [ ] **Step 6: Write `synth/render.py`**

```python
"""Draws synthetic documents with PyMuPDF. Coordinates are PDF points (612 x 792)."""
import pymupdf

from .spec import InvoiceSpec, money
from .styles import LayoutStyle
from .vendors import Vendor

W, H = 612, 792
BOTTOM = 690
BILL_TO = ["Bill To:", "Synthetic Agency, Accounts Payable", "100 Example Plaza, Washington, DC 20000"]


def _text(page, x, y, s, size, font, align="left"):
    if align != "left":
        w = pymupdf.get_text_length(s, fontname=font, fontsize=size)
        x = x - w if align == "right" else x - w / 2
    page.insert_text((x, y), s, fontsize=size, fontname=font)


def _new_page(doc):
    return doc.new_page(width=W, height=H)


def _vendor_block(page, v: Vendor, st: LayoutStyle, title: str):
    if st.vendor_at == "left":
        vx, va, tx, ta, ty = 40, "left", 572, "right", 50
    elif st.vendor_at == "right":
        vx, va, tx, ta, ty = 572, "right", 40, "left", 50
    else:
        vx, va, tx, ta, ty = 306, "center", 306, "center", 95
    _text(page, vx, 50, v.name, 16, st.bold, va)
    _text(page, vx, 64, v.street, 9, st.font, va)
    _text(page, vx, 75, v.city, 9, st.font, va)
    _text(page, tx, ty, title, 20, st.bold, ta)
    return vx, va


def _ids(page, inv: InvoiceSpec, st: LayoutStyle, x, y, align):
    v = inv.vendor
    _text(page, x, y, f"{st.labels['tin']}: {v.tin}", 9, st.font, align)
    _text(page, x, y + 11, f"{st.labels['contact']}: {v.contact}", 9, st.font, align)


def _remit(page, inv: InvoiceSpec, st: LayoutStyle, x, y):
    _text(page, x, y, f"{st.labels['remit_to']}:", 9, st.bold)
    for i, line in enumerate(inv.remit_lines, start=1):
        _text(page, x, y + 11 * i, line, 9, st.font)


def _spans(st: LayoutStyle):
    x, out = 40, []
    for c in st.columns:
        w = 250 if c == "desc" else 85
        out.append((c, x, x + w))
        x += w
    return out


def _row(page, st, y, cells, font):
    for c, x0, x1 in _spans(st):
        if c == "desc":
            _text(page, x0, y, cells[c], 9, font)
        else:
            _text(page, x1 - 4, y, cells[c], 9, font, "right")


def _header(page, st, y):
    _row(page, st, y, st.col_titles, st.bold)
    page.draw_line((40, y + 4), (545, y + 4))


def render_invoice(doc, inv: InvoiceSpec, st: LayoutStyle) -> list[int]:
    """Appends the invoice to doc and returns its 1-based page numbers."""
    first = doc.page_count + 1
    page = _new_page(doc)
    title = st.credit_title if inv.credit else st.title
    vx, va = _vendor_block(page, inv.vendor, st, title)
    if st.ids_at == "header":
        _ids(page, inv, st, vx, 88, va)

    values = {
        "invoice_number": inv.invoice_number,
        "invoice_date": inv.invoice_date.strftime(st.date_fmt),
        "contract_number": inv.contract_number,
        "payment_terms": inv.payment_terms,
    }
    mx, my = st.meta_at
    for key in ("invoice_number", "invoice_date", "contract_number", "payment_terms"):
        if key in inv.omit:
            continue
        if st.label_mode == "inline":
            _text(page, mx, my, f"{st.labels[key]}:", 10, st.bold)
            _text(page, mx + 120, my, values[key], 10, st.font)
            my += 16
        else:
            _text(page, mx, my, st.labels[key], 8, st.font)
            _text(page, mx, my + 11, values[key], 10, st.bold)
            mx += 135

    bx, by = st.bill_at
    for i, line in enumerate(BILL_TO):
        _text(page, bx, by + 11 * i, line, 9, st.bold if i == 0 else st.font)
    if st.remit_at == "mid" and "remit_to" not in inv.omit:
        _remit(page, inv, st, *st.remit_mid_at)

    y = st.table_y
    _header(page, st, y)
    for li in inv.lines:
        y += 16
        if y > BOTTOM:
            page = _new_page(doc)
            _text(page, 572, 30, f"Page {doc.page_count - first + 1}", 8, st.font, "right")
            y = 60
            if st.repeat_header:
                _header(page, st, y)
                y += 16
        _row(page, st, y, {
            "desc": li.description,
            "qty": f"{li.quantity:g}",
            "unit": money(li.unit_price, st.money),
            "amount": money(inv.amount(li), st.money),
        }, st.font)

    y += 26
    if y + 40 > BOTTOM:
        page = _new_page(doc)
        _text(page, 572, 30, f"Page {doc.page_count - first + 1}", 8, st.font, "right")
        y = 60
    totals_y = y
    for key, val, font in (("subtotal", inv.subtotal, st.font), ("tax", inv.tax, st.font),
                           ("total", inv.total, st.bold)):
        _text(page, 455, y, f"{st.labels[key]}:", 9, font, "right")
        _text(page, 545, y, money(val, st.money), 10 if key == "total" else 9, font, "right")
        y += 14
    if st.remit_at == "after_totals" and "remit_to" not in inv.omit:
        _remit(page, inv, st, 40, totals_y)
    if st.remit_at == "footer" and "remit_to" not in inv.omit:
        _remit(page, inv, st, 40, 712)
    if st.ids_at == "footer":
        _ids(page, inv, st, 330 if st.remit_at == "footer" else 40, 760 if st.remit_at != "footer" else 712, "left")
    return list(range(first, doc.page_count + 1))


def render_statement(doc, v: Vendor, st: LayoutStyle, rows: list[tuple[str, str, float]]) -> list[int]:
    first = doc.page_count + 1
    page = _new_page(doc)
    _vendor_block(page, v, st, "STATEMENT OF ACCOUNT")
    y = 200
    _text(page, 40, y, "Open items as of statement date", 10, st.bold)
    for number, when, amount in rows:
        y += 16
        _text(page, 40, y, f"Invoice {number}", 9, st.font)
        _text(page, 260, y, when, 9, st.font)
        _text(page, 545, y, money(amount, st.money), 9, st.font, "right")
    _text(page, 40, y + 30, "Past due balances are shown above. Please remit promptly.", 9, st.font)
    return [first]


def render_packing_slip(doc, inv: InvoiceSpec, st: LayoutStyle) -> list[int]:
    first = doc.page_count + 1
    page = _new_page(doc)
    _vendor_block(page, inv.vendor, st, "PACKING SLIP")
    _text(page, 40, 200, f"Shipment for order {inv.contract_number}", 10, st.bold)
    y = 220
    for li in inv.lines:
        y += 16
        _text(page, 40, y, li.description, 9, st.font)
        _text(page, 545, y, f"{li.quantity:g}", 9, st.font, "right")
    return [first]
```

- [ ] **Step 7: Write `synth/generate.py`**

```python
"""Builds the dev and held-out sets: .eml files, the PDFs inside them, and ground truth.

Run: python -m synth.generate --out data
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import format_datetime
from pathlib import Path

import pymupdf

from .render import render_invoice, render_packing_slip, render_statement
from .spec import InvoiceSpec, Line
from .styles import STYLES
from .vendors import SERVICES, VENDORS

EMAILS_PER_LAYOUT = {"dev": 12, "heldout": 14}
MISSING = ("contract_number", "remit_to", "invoice_date")
TERMS = ("Net 30", "Net 45", "Net 15", "Due upon receipt")
_META = {"producer": "synthetic", "creationDate": "D:20261009000000", "modDate": "D:20261009000000"}


def _invoice(rng: random.Random, vendor, n_lines: int, **kw) -> InvoiceSpec:
    start = date(2026, 7, 1)
    num = f"{vendor.inv_prefix}{rng.randint(10000, 99999)}"
    lines = [Line(rng.choice(SERVICES), float(rng.randint(1, 40)), round(rng.uniform(15, 900), 2))
             for _ in range(n_lines)]
    return InvoiceSpec(
        vendor=vendor, invoice_number=num, invoice_date=start + timedelta(days=rng.randint(0, 92)),
        contract_number=f"SYN-26-{rng.choice('CF')}-{rng.randint(1000, 99999):05d}",
        payment_terms=rng.choice(TERMS), lines=lines, tax_rate=rng.choice((0.0, 0.0, 0.05)), **kw,
    )


def _expected(inv: InvoiceSpec, extra: list[str] | None = None) -> tuple[str, list[str]]:
    codes = [f"MISSING_{f.upper()}" for f in inv.omit]
    if inv.total_delta:
        codes.append("ARITH_TOTAL")
    if inv.credit:
        codes.append("CREDIT_MEMO")
    codes += extra or []
    if any(c.startswith("MISSING_") for c in codes):
        return "likely_improper", codes
    return ("needs_attention" if codes else "ready"), codes


def _truth_fields(inv: InvoiceSpec) -> dict:
    v = inv.vendor
    return {
        "vendor_name": v.name,
        "invoice_number": inv.invoice_number,
        "invoice_date": None if "invoice_date" in inv.omit else inv.invoice_date.isoformat(),
        "contract_number": None if "contract_number" in inv.omit else inv.contract_number,
        "payment_terms": inv.payment_terms,
        "remit_to": None if "remit_to" in inv.omit else ", ".join(inv.remit_lines),
        "contact": v.contact,
        "tin": v.tin,
        "subtotal": inv.subtotal,
        "tax": inv.tax,
        "total": inv.total,
    }


def _truth_doc(email_id, index, pages, kind, inv=None, extra=None) -> dict:
    d = {"doc_id": f"{email_id}-{index}-{pages[0]}", "pages": pages, "kind": kind}
    if inv is None:
        d.update(expected_status=None, expected_codes=[], fields={}, line_items=[])
    else:
        status, codes = _expected(inv, extra)
        d.update(expected_status=status, expected_codes=codes, fields=_truth_fields(inv),
                 line_items=[{"description": li.description, "quantity": li.quantity,
                              "unit_price": li.unit_price, "amount": inv.amount(li)} for li in inv.lines])
    return d


def _pdf_bytes(doc) -> bytes:
    doc.set_metadata(_META)
    return doc.tobytes(garbage=3, deflate=True)


def _write_email(out: Path, email_id: str, vendor, subject: str, sent: date,
                 attachments: list[tuple[str, bytes]]) -> None:
    msg = EmailMessage()
    msg["From"] = f"Accounts Receivable <billing@{vendor.domain}>"
    msg["To"] = "ap-invoices@agency.example"
    msg["Subject"] = subject
    msg["Date"] = format_datetime(datetime(sent.year, sent.month, sent.day, 9, 30, tzinfo=timezone.utc))
    msg["Message-ID"] = f"<{email_id}@synthetic.example>"
    msg.set_content("Please see the attached. This is synthetic test data.")
    for name, data in attachments:
        msg.add_attachment(data, maintype="application", subtype="pdf", filename=name)
        pdf_dir = out / "pdf" / email_id
        pdf_dir.mkdir(parents=True, exist_ok=True)
        (pdf_dir / name).write_bytes(data)
    (out / "inbox").mkdir(parents=True, exist_ok=True)
    (out / "inbox" / f"{email_id}.eml").write_bytes(bytes(msg))


def build_set(name: str, out: Path) -> list[dict]:
    out = Path(out)
    styles = [s for s in STYLES if s.held_out == (name == "heldout")]
    prefix = "H" if name == "heldout" else "D"
    truth: list[dict] = []
    counter = 0
    originals = []

    def next_id():
        nonlocal counter
        counter += 1
        return f"{prefix}{counter:03d}"

    for si, st in enumerate(styles):
        rng = random.Random(f"{name}:{st.layout_id}")
        for e in range(EMAILS_PER_LAYOUT[name]):
            vendor = VENDORS[(si * 5 + e) % len(VENDORS)]
            eid = next_id()
            docs_truth, attachments = [], []
            pdf = pymupdf.open()
            if e == 7:  # two invoices in one PDF
                invs = [_invoice(rng, vendor, rng.randint(1, 5)), _invoice(rng, vendor, rng.randint(1, 5))]
                for inv in invs:
                    pages = render_invoice(pdf, inv, st)
                    docs_truth.append(_truth_doc(eid, 0, pages, "invoice", inv))
                subject = f"Invoices {invs[0].invoice_number}, {invs[1].invoice_number}"
                sent = max(i.invoice_date for i in invs)
            else:
                kw = {}
                if e == 3:
                    kw["omit"] = (MISSING[si % 3],)
                elif e == 11:
                    kw["omit"] = (MISSING[(si + 1) % 3],)
                elif e == 5:
                    kw["total_delta"] = 100.0
                elif e == 9:
                    kw["credit"] = True
                inv = _invoice(rng, vendor, rng.randint(28, 36) if e == 1 else rng.randint(1, 6), **kw)
                pages = render_invoice(pdf, inv, st)
                docs_truth.append(_truth_doc(eid, 0, pages, "credit_memo" if inv.credit else "invoice", inv))
                subject = f"{'Credit memo' if inv.credit else 'Invoice'} {inv.invoice_number} from {vendor.name}"
                sent = inv.invoice_date
                if e in (0, 2) and len(originals) < 2:
                    originals.append((inv, st))
            filename = f"{docs_truth[0]['fields']['invoice_number']}.pdf"
            attachments.append((filename, _pdf_bytes(pdf)))
            atts_truth = [{"index": 0, "filename": filename, "documents": docs_truth}]
            if e == 8:  # invoice plus a supporting document
                slip = pymupdf.open()
                pages = render_packing_slip(slip, inv, st)
                attachments.append(("packing-slip.pdf", _pdf_bytes(slip)))
                atts_truth.append({"index": 1, "filename": "packing-slip.pdf",
                                   "documents": [_truth_doc(eid, 1, pages, "other")]})
            _write_email(out, eid, vendor, subject, sent, attachments)
            truth.append({"email_id": eid, "layout_id": st.layout_id, "held_out": st.held_out,
                          "subject": subject, "attachments": atts_truth})

    st = styles[0]
    rng = random.Random(f"{name}:extras")
    for k in range(2):  # non-invoice emails
        vendor = VENDORS[(k * 7 + 3) % len(VENDORS)]
        eid = next_id()
        pdf = pymupdf.open()
        rows = [(f"{vendor.inv_prefix}{rng.randint(10000, 99999)}", "08/15/2026", round(rng.uniform(100, 5000), 2))
                for _ in range(3)]
        pages = render_statement(pdf, vendor, st, rows)
        _write_email(out, eid, vendor, "Statement of account", date(2026, 10, 1), [("statement.pdf", _pdf_bytes(pdf))])
        truth.append({"email_id": eid, "layout_id": st.layout_id, "held_out": st.held_out,
                      "subject": "Statement of account",
                      "attachments": [{"index": 0, "filename": "statement.pdf",
                                       "documents": [_truth_doc(eid, 0, pages, "other")]}]})
    for inv, ost in originals:  # duplicate resends
        eid = next_id()
        pdf = pymupdf.open()
        pages = render_invoice(pdf, inv, ost)
        filename = f"{inv.invoice_number}.pdf"
        subject = f"Resending invoice {inv.invoice_number}"
        _write_email(out, eid, inv.vendor, subject, inv.invoice_date + timedelta(days=20),
                     [(filename, _pdf_bytes(pdf))])
        truth.append({"email_id": eid, "layout_id": ost.layout_id, "held_out": ost.held_out, "subject": subject,
                      "attachments": [{"index": 0, "filename": filename,
                                       "documents": [_truth_doc(eid, 0, pages, "invoice", inv, ["DUPLICATE"])]}]})

    (out / "truth").mkdir(parents=True, exist_ok=True)
    for t in truth:
        (out / "truth" / f"{t['email_id']}.json").write_text(json.dumps(t, indent=2, sort_keys=True))
    return json.loads(json.dumps(truth, sort_keys=True))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="data")
    args = p.parse_args()
    for name in ("dev", "heldout"):
        truth = build_set(name, Path(args.out) / name)
        n = sum(len(a["documents"]) for t in truth for a in t["attachments"])
        print(f"{name}: {len(truth)} emails, {n} documents")


if __name__ == "__main__":
    main()
```

Note: `build_set` returns the truth round-tripped through JSON so the determinism test compares plain data. The `pdf/` folder beside `inbox/` keeps a copy of each attachment for inspection and tests.

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `python -m pytest tests/test_synth.py -q`
Expected: all pass. If `test_dev_set_uses_only_dev_layouts_and_has_edge_cases` fails on the document count, print the count and adjust `EMAILS_PER_LAYOUT`, keeping the total near 150 across both sets.

- [ ] **Step 9: Generate the sets and look at them**

Run: `python -m synth.generate --out data`
Expected: two lines like `dev: 88 emails, 107 documents` and `heldout: 46 emails, 54 documents`.
Then render one page per layout to PNG with `pymupdf` (`page.get_pixmap(dpi=80).save(...)` into `out/preview/`) and look at each: nothing overlaps, every value sits next to its label, and the credit memo and multi-page invoices look right. Fix coordinates in `styles.py` or `render.py` if not, regenerate, and rerun Step 8.

- [ ] **Step 10: Commit**

```bash
git add poc/intake/synth poc/intake/tests/test_synth.py poc/intake/data
git commit -m "Generate synthetic invoice emails with ground truth and three held-out layouts"
```

---

### Task 3: Ingest, classify and split

**Files:**
- Create: `poc/intake/intake/ingest.py`, `poc/intake/intake/classify.py`
- Test: `poc/intake/tests/test_ingest_classify.py`

**Interfaces:**
- Consumes: `Attachment`, `Email`, `Document` (Task 1).
- Produces: `read_email(path: Path, attach_dir: Path) -> tuple[Email, str]` (email and SHA-256 of the raw file); `split_and_classify(att: Attachment) -> list[Document]`; `TITLE_SIZE = 14.0`.

- [ ] **Step 1: Write the failing tests**

```python
from email.message import EmailMessage
from pathlib import Path

import pymupdf

from intake.classify import split_and_classify
from intake.ingest import read_email
from intake.models import Attachment
from synth.generate import build_set


def _eml(tmp_path: Path, attachments: list[tuple[str, bytes]]) -> Path:
    msg = EmailMessage()
    msg["From"] = "billing@contoso-facility.example"
    msg["Subject"] = "Invoice"
    msg["Date"] = "Fri, 09 Oct 2026 09:30:00 +0000"
    msg.set_content("body")
    for name, data in attachments:
        msg.add_attachment(data, maintype="application", subtype="octet-stream", filename=name)
    p = tmp_path / "X001.eml"
    p.write_bytes(bytes(msg))
    return p


def _att(path: Path, name: str, index=0) -> Attachment:
    return Attachment("X001", index, name, str(path), "sha")


def test_read_email_saves_attachments(tmp_path):
    eml = _eml(tmp_path, [("a.pdf", b"%PDF-1.4 x"), ("b.txt", b"hello")])
    email, sha = read_email(eml, tmp_path / "att")
    assert email.email_id == "X001" and len(sha) == 64
    assert [a.filename for a in email.attachments] == ["a.pdf", "b.txt"]
    assert Path(email.attachments[1].path).read_bytes() == b"hello"


def test_generated_multi_invoice_pdf_is_split(tmp_path):
    truth = build_set("dev", tmp_path)
    t = next(t for t in truth if len(t["attachments"][0]["documents"]) == 2)
    a = t["attachments"][0]
    docs = split_and_classify(_att(tmp_path / "pdf" / t["email_id"] / a["filename"], a["filename"]))
    assert [d.pages for d in docs] == [d["pages"] for d in a["documents"]]
    assert all(d.kind == "invoice" for d in docs)


def test_generated_multi_page_invoice_is_one_document(tmp_path):
    truth = build_set("dev", tmp_path)
    t = next(t for t in truth if len(t["attachments"][0]["documents"][0]["pages"]) > 1)
    a = t["attachments"][0]
    docs = split_and_classify(_att(tmp_path / "pdf" / t["email_id"] / a["filename"], a["filename"]))
    assert len(docs) == 1 and docs[0].pages == a["documents"][0]["pages"]


def test_statement_and_credit_memo_are_classified(tmp_path):
    truth = build_set("dev", tmp_path)
    by_kind = {}
    for t in truth:
        for a in t["attachments"]:
            for d in a["documents"]:
                by_kind.setdefault(d["kind"], (t, a))
    for kind in ("other", "credit_memo"):
        t, a = by_kind[kind]
        docs = split_and_classify(_att(tmp_path / "pdf" / t["email_id"] / a["filename"], a["filename"]))
        assert docs[0].kind == kind


def test_image_only_pdf_is_unreadable(tmp_path):
    pdf = pymupdf.open()
    page = pdf.new_page()
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 50, 50), 0)
    pix.clear_with(200)
    page.insert_image(pymupdf.Rect(50, 50, 300, 300), pixmap=pix)
    path = tmp_path / "scan.pdf"
    pdf.save(path)
    docs = split_and_classify(_att(path, "scan.pdf"))
    assert docs[0].kind == "unreadable" and "no text layer" in docs[0].note


def test_corrupt_and_non_pdf_attachments_are_unreadable(tmp_path):
    bad = tmp_path / "broken.pdf"
    bad.write_bytes(b"not really a pdf")
    other = tmp_path / "invoice.docx"
    other.write_bytes(b"PK")
    assert split_and_classify(_att(bad, "broken.pdf"))[0].kind == "unreadable"
    d = split_and_classify(_att(other, "invoice.docx", 1))[0]
    assert d.kind == "unreadable" and d.doc_id == "X001-1-0" and "not a PDF" in d.note
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `python -m pytest tests/test_ingest_classify.py -q`
Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Write `intake/ingest.py`**

```python
"""Reads .eml files and saves their attachments. Locally the inbox is a folder;
on a platform it would be a mailbox reader that writes the same records."""
from __future__ import annotations

import hashlib
import re
from email import policy
from email.parser import BytesParser
from pathlib import Path

from .models import Attachment, Email


def read_email(path: Path, attach_dir: Path) -> tuple[Email, str]:
    raw = Path(path).read_bytes()
    msg = BytesParser(policy=policy.default).parsebytes(raw)
    email_id = Path(path).stem
    attachments = []
    for i, part in enumerate(msg.iter_attachments()):
        data = part.get_payload(decode=True) or b""
        name = part.get_filename() or f"attachment-{i}"
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", name)
        dest = Path(attach_dir) / email_id / f"{i}-{safe}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        attachments.append(Attachment(email_id, i, name, str(dest), hashlib.sha256(data).hexdigest()))
    email = Email(email_id, str(msg.get("From", "")), str(msg.get("Subject", "")), str(msg.get("Date", "")),
                  attachments)
    return email, hashlib.sha256(raw).hexdigest()
```

- [ ] **Step 4: Write `intake/classify.py`**

```python
"""Decides what each attachment holds and splits PDFs that contain several invoices.

A page starts a new document when it carries a large title (an invoice, credit
memo or non-invoice title). Pages without one continue the previous document.
"""
from __future__ import annotations

import re

import pymupdf

from .models import Attachment, Document

TITLE_SIZE = 14.0
OTHER_RE = re.compile(r"\b(statement of account|account statement|past due notice|packing slip|"
                      r"delivery receipt|remittance advice)\b", re.I)
CREDIT_RE = re.compile(r"\bcredit\s+(memo|note)\b", re.I)
INVOICE_RE = re.compile(r"\b(invoice|bill)\b", re.I)


def _titles(page) -> list[str]:
    limit = page.rect.height * 0.4
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                if span["size"] >= TITLE_SIZE and span["bbox"][1] < limit and span["text"].strip():
                    out.append(span["text"].strip())
    return out


def title_kind(titles: list[str]) -> str | None:
    for t in titles:
        if OTHER_RE.search(t):
            return "other"
    for t in titles:
        if CREDIT_RE.search(t):
            return "credit_memo"
    for t in titles:
        if INVOICE_RE.search(t):
            return "invoice"
    return None


def _unreadable(att: Attachment, note: str) -> list[Document]:
    return [Document(f"{att.email_id}-{att.index}-0", att.email_id, att.index, att.filename, att.path,
                     att.sha256, [], "unreadable", note)]


def split_and_classify(att: Attachment) -> list[Document]:
    if not att.filename.lower().endswith(".pdf"):
        return _unreadable(att, "not a PDF; a technician must open it")
    try:
        pdf = pymupdf.open(att.path)
    except Exception:
        return _unreadable(att, "file could not be opened")
    with pdf:
        if not any(p.get_text().strip() for p in pdf):
            return _unreadable(att, "no text layer (possibly a scan); OCR is not in this proof of concept")
        groups: list[list[int]] = []
        kinds: list[str] = []
        for pno, page in enumerate(pdf, start=1):
            kind = title_kind(_titles(page))
            if kind is not None or not groups:
                groups.append([pno])
                kinds.append(kind or "other")
            else:
                groups[-1].append(pno)
    return [Document(f"{att.email_id}-{att.index}-{g[0]}", att.email_id, att.index, att.filename, att.path,
                     att.sha256, g, k) for g, k in zip(groups, kinds)]
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `python -m pytest tests/test_ingest_classify.py -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add poc/intake/intake/ingest.py poc/intake/intake/classify.py poc/intake/tests/test_ingest_classify.py
git commit -m "Read intake emails and split attachments into invoices, credit memos and other documents"
```

---

### Task 4: Text-layer extractor

**Files:**
- Create: `poc/intake/intake/extract/__init__.py` (empty), `extract/base.py`, `extract/lexicon.py`, `extract/layout.py`, `extract/textlayer.py`, `poc/intake/config/thresholds.yaml`, `poc/intake/intake/config.py`
- Test: `poc/intake/tests/test_extract.py`

**Interfaces:**
- Consumes: `Document`, `Extraction`, `FieldValue`, `LineItem`, `parse_amount`, `parse_date`, `fmt_amount`, `norm_id` (Task 1).
- Produces: `Extractor` protocol with `name: str` and `extract(doc: Document, context: dict[str, str]) -> Extraction` (context keys `subject`, `sender`); `TextLayerExtractor(weights: dict[str, float])`; `Config(checklist: dict, thresholds: dict)`; `load_config(path: Path | None = None) -> Config`; `LEXICON`, `is_label(text) -> bool`.

Development rule: tune `lexicon.py` and the extraction logic against the **dev** set only. Do not run or inspect held-out results until Task 8.

- [ ] **Step 1: Write `config/thresholds.yaml` and `intake/config.py`**

```yaml
# Weights for field confidence. They must sum to 1. Calibration is checked in the metrics report.
weights:
  label: 0.35       # how specific the label was, and where the value sat relative to it
  format: 0.25      # whether the value parsed as the expected type
  agreement: 0.20   # whether another source agreed (email subject, sender, arithmetic)
  margin: 0.20      # how far ahead of the next-best different value
# An invoice is "Ready for review" only if every required field is at or above this.
ready_min_confidence: 0.80
```

```python
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml

DEFAULT_DIR = Path(__file__).resolve().parent.parent / "config"


@dataclass
class Config:
    checklist: dict
    thresholds: dict

    @property
    def required_fields(self) -> list[str]:
        return [r["field"] for r in self.checklist["required"]]


def load_config(path: Path | None = None) -> Config:
    d = Path(path) if path else DEFAULT_DIR
    checklist = yaml.safe_load((d / "checklist.yaml").read_text()) if (d / "checklist.yaml").exists() else {}
    thresholds = yaml.safe_load((d / "thresholds.yaml").read_text())
    return Config(checklist, thresholds)
```

(`checklist.yaml` arrives in Task 5; `load_config` tolerates its absence until then.)

- [ ] **Step 2: Write the failing tests**

`tests/test_extract.py`:
```python
import ast
from datetime import date
from pathlib import Path

import pymupdf
import pytest

from intake.config import load_config
from intake.extract.textlayer import TextLayerExtractor
from intake.models import Document
from synth.render import render_invoice
from synth.spec import InvoiceSpec, Line
from synth.styles import STYLES
from synth.vendors import VENDORS

DEV = [s for s in STYLES if not s.held_out]


def _doc(tmp_path, style, **kw):
    inv = InvoiceSpec(VENDORS[0], "CF-10233", date(2026, 9, 14), "SYN-26-C-01234", "Net 30",
                      [Line("Janitorial services, Building A", 2, 450.0), Line("Office supplies", 10, 12.5)],
                      0.05, **kw)
    pdf = pymupdf.open()
    pages = render_invoice(pdf, inv, style)
    path = tmp_path / f"{style.layout_id}.pdf"
    pdf.save(path)
    return inv, Document("T-0-1", "T", 0, path.name, str(path), "sha", pages, "invoice")


def _extract(doc):
    ex = TextLayerExtractor(load_config().thresholds["weights"])
    return ex.extract(doc, {"subject": "Invoice CF-10233 from Contoso Facility Services",
                            "sender": "billing@contoso-facility.example"})


@pytest.mark.parametrize("style", DEV, ids=lambda s: s.layout_id)
def test_dev_layouts_extract_core_fields(tmp_path, style):
    inv, doc = _doc(tmp_path, style)
    ex = _extract(doc)
    assert ex.value("invoice_number") == "CF-10233"
    assert ex.value("invoice_date") == "2026-09-14"
    assert ex.value("contract_number") == "SYN-26-C-01234"
    assert ex.value("total") == f"{inv.total:.2f}"
    assert ex.value("vendor_name") == "Contoso Facility Services"
    assert ex.value("tin") == VENDORS[0].tin
    assert [li.amount for li in ex.line_items] == [900.0, 125.0]


def test_confidence_comes_from_factors(tmp_path):
    _, doc = _doc(tmp_path, DEV[0])
    f = _extract(doc).fields["invoice_number"]
    assert set(f.factors) == {"label", "format", "agreement", "margin"}
    w = load_config().thresholds["weights"]
    assert f.confidence == pytest.approx(sum(w[k] * f.factors[k] for k in w))
    assert f.page == 1 and f.bbox is not None


def test_omitted_field_is_absent_with_zero_confidence(tmp_path):
    _, doc = _doc(tmp_path, DEV[0], omit=("contract_number",))
    f = _extract(doc).fields["contract_number"]
    assert f.value is None and f.confidence == 0.0


def test_remit_to_is_multiline(tmp_path):
    _, doc = _doc(tmp_path, DEV[0])
    assert _extract(doc).value("remit_to") == "Contoso Facility Services, PO Box 1000, Fairview, VA 20100"


def test_intake_package_never_imports_synth():
    root = Path(__file__).resolve().parent.parent / "intake"
    for py in root.rglob("*.py"):
        tree = ast.parse(py.read_text())
        for node in ast.walk(tree):
            names = [a.name for a in node.names] if isinstance(node, ast.Import) else \
                    [node.module or ""] if isinstance(node, ast.ImportFrom) else []
            assert not any(n.split(".")[0] == "synth" for n in names), py
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `python -m pytest tests/test_extract.py -q`
Expected: `ModuleNotFoundError: No module named 'intake.extract.textlayer'`.

- [ ] **Step 4: Write `extract/base.py` and `extract/lexicon.py`**

```python
from typing import Protocol

from ..models import Document, Extraction


class Extractor(Protocol):
    """Reads one document and returns field values with confidence.

    Local: TextLayerExtractor. On a platform: an adapter around a hosted
    document-AI or model service that returns the same Extraction."""
    name: str

    def extract(self, doc: Document, context: dict[str, str]) -> Extraction: ...
```

```python
"""Label vocabulary for invoice fields, written from common AP practice.

Each entry is (regex, specificity). Patterns must match at the start of a text
segment. Tune against the dev set only; never against held-out layouts.
"""
import re

LEXICON: dict[str, list[tuple[str, float]]] = {
    "invoice_number": [(r"invoice\s*(no\.?|number|num\.?|#)", 1.0), (r"inv\.?\s*(no\.?|#)", 0.9),
                       (r"bill\s*(no\.?|number|#)", 0.8), (r"reference\s*(no\.?|number|#)", 0.5),
                       (r"document\s*(no\.?|number|#)", 0.5)],
    "invoice_date": [(r"invoice\s*date", 1.0), (r"date\s*of\s*invoice", 1.0), (r"bill(ing)?\s*date", 0.8),
                     (r"issued(\s*on)?\b", 0.6), (r"date\b", 0.5)],
    "contract_number": [(r"contract\s*(no\.?|number|#)", 1.0), (r"task\s*order(\s*(no\.?|number|#))?", 0.9),
                        (r"(purchase\s*)?order\s*(no\.?|number|#)", 0.9), (r"p\.?o\.?\s*(no\.?|number|#)", 0.9),
                        (r"award\s*(no\.?|number|#)", 0.8), (r"agreement\s*(no\.?|number|#)", 0.7)],
    "payment_terms": [(r"(payment\s*)?terms\b", 1.0)],
    "total": [(r"(invoice\s*)?total\s*(amount\s*)?due", 1.0), (r"amount\s*due", 1.0), (r"balance\s*due", 0.9),
              (r"grand\s*total", 0.9), (r"total\b", 0.8)],
    "subtotal": [(r"sub-?\s*total", 1.0)],
    "tax": [(r"(sales\s*)?tax\b(?!\s*id)", 1.0)],
    "tin": [(r"(tin|ein)\b", 1.0), (r"(federal\s*)?tax\s*id(entification)?(\s*(no\.?|number|#))?", 1.0),
            (r"taxpayer\s*id(entification)?(\s*(no\.?|number))?", 1.0)],
    "contact": [(r"(billing\s*)?contact\b", 0.9), (r"questions\?", 0.8), (r"inquiries", 0.8)],
    "remit_to": [(r"remit(\s*payment)?\s*to", 1.0), (r"(send|mail)\s*payments?\s*to", 1.0),
                 (r"pay(ment)?\s*address", 0.8), (r"pay\s*to", 0.7)],
}
SUBTOTAL_RE = re.compile(r"sub-?\s*total", re.I)
_COMPILED = {f: [(re.compile(p, re.I), s) for p, s in pats] for f, pats in LEXICON.items()}


def match_label(field: str, text: str) -> tuple[float, int] | None:
    """Best (specificity, end offset) for a label at the start of text, or None."""
    t = text.strip()
    if field == "total" and SUBTOTAL_RE.match(t):
        return None
    best = None
    for rx, spec in _COMPILED[field]:
        m = rx.match(t)
        if m and (best is None or spec > best[0]):
            best = (spec, m.end() + (len(text) - len(text.lstrip())))
    return best


def is_label(text: str) -> bool:
    return any(match_label(f, text) for f in LEXICON)
```

- [ ] **Step 5: Write `extract/layout.py`**

```python
"""Turns a PDF page into text segments: words on the same baseline, split where
the horizontal gap is wide. Segments keep their position and font size."""
from __future__ import annotations

from dataclasses import dataclass

import pymupdf

GAP = 10.0
ROW_TOL = 2.0


@dataclass
class Seg:
    page: int
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    size: float

    @property
    def bbox(self) -> tuple[float, float, float, float]:
        return (round(self.x0, 1), round(self.y0, 1), round(self.x1, 1), round(self.y1, 1))


def segments(page, pno: int) -> list[Seg]:
    spans = [(pymupdf.Rect(s["bbox"]), s["size"])
             for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]]

    def size_at(w) -> float:
        p = pymupdf.Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)
        return next((sz for r, sz in spans if r.contains(p)), 0.0)

    words = sorted(page.get_text("words"), key=lambda w: (w[3], w[0]))
    rows: list[list] = []
    for w in words:
        if rows and abs(rows[-1][-1][3] - w[3]) < ROW_TOL:
            rows[-1].append(w)
        else:
            rows.append([w])
    out: list[Seg] = []
    for row in rows:
        row.sort(key=lambda w: w[0])
        cur = [row[0]]
        for w in row[1:]:
            if w[0] - cur[-1][2] > GAP:
                out.append(_mk(cur, pno, size_at))
                cur = [w]
            else:
                cur.append(w)
        out.append(_mk(cur, pno, size_at))
    return out


def _mk(ws, pno, size_at) -> Seg:
    return Seg(pno, " ".join(w[4] for w in ws), min(w[0] for w in ws), min(w[1] for w in ws),
               max(w[2] for w in ws), max(w[3] for w in ws), max(size_at(w) for w in ws))


def same_row(a: Seg, b: Seg) -> bool:
    return a.page == b.page and abs(a.y1 - b.y1) < ROW_TOL


def rows_of(segs: list[Seg]) -> list[list[Seg]]:
    rows: list[list[Seg]] = []
    for s in sorted(segs, key=lambda s: (s.page, s.y1, s.x0)):
        if rows and same_row(rows[-1][0], s):
            rows[-1].append(s)
        else:
            rows.append([s])
    return rows


def nearest_right(s: Seg, segs: list[Seg], max_gap: float = 250) -> Seg | None:
    c = [t for t in segs if t is not s and same_row(s, t) and t.x0 > s.x1 and t.x0 - s.x1 <= max_gap]
    return min(c, key=lambda t: t.x0, default=None)


def nearest_below(s: Seg, segs: list[Seg], max_gap: float = 16, aligned: bool = False) -> Seg | None:
    def ok(t):
        if t is s or t.page != s.page or not (s.y1 - 1 <= t.y0 <= s.y1 + max_gap):
            return False
        if aligned:
            return abs(t.x0 - s.x0) <= 6
        return min(s.x1, t.x1) - max(s.x0, t.x0) > 0
    return min((t for t in segs if ok(t)), key=lambda t: t.y0, default=None)
```

- [ ] **Step 6: Write `extract/textlayer.py`**

```python
"""Local extractor: reads the PDF text layer and finds values by label, position
and value type. No per-vendor templates. Scanned PDFs are out of scope."""
from __future__ import annotations

import re
from dataclasses import dataclass

import pymupdf

from ..models import Document, Extraction, FieldValue, LineItem
from ..normalize import fmt_amount, norm_id, parse_amount, parse_date
from .layout import Seg, nearest_below, nearest_right, rows_of, segments
from .lexicon import is_label, match_label

PHONE = re.compile(r"\(?\d{3}\)?[\s.-]?\d{3}-\d{4}")
TIN = re.compile(r"\b\d{2}-\d{7}\b")
ID_TOKEN = re.compile(r"[A-Za-z0-9][A-Za-z0-9\-/.]*\d[A-Za-z0-9\-/.]*")
TITLE_WORDS = re.compile(r"\b(invoice|bill|credit\s+memo|statement)\b", re.I)
SINGLE_LINE = ("invoice_number", "invoice_date", "contract_number", "payment_terms",
               "total", "subtotal", "tax", "tin", "contact")
COLUMN_ROLES = (("desc", re.compile(r"^(description|item|service|details|services)\b", re.I)),
                ("qty", re.compile(r"^(qty|quantity|hours|hrs|units)\b", re.I)),
                ("amount", re.compile(r"^(amount|extended|ext\.?\s*price|line\s*total|total)\b", re.I)),
                ("unit", re.compile(r"^(unit\s*price|unit\s*cost|unit|rate|price)\b", re.I)))
STOP_ROW = re.compile(r"(sub-?\s*total|total|amount\s*due|balance\s*due|\btax\b)", re.I)


def _parse(field: str, text: str) -> str | None:
    text = text.strip(" :#-\t")
    if not text:
        return None
    if field in ("total", "subtotal", "tax"):
        x = parse_amount(text)
        return None if x is None else fmt_amount(x)
    if field == "invoice_date":
        return parse_date(text)
    if field in ("invoice_number", "contract_number"):
        m = ID_TOKEN.search(text)
        return m.group(0).rstrip(".") if m else None
    if field == "tin":
        m = TIN.search(text)
        return m.group(0) if m else None
    if field == "contact":
        hit = match_label("contact", text)
        if hit:
            text = text[hit[1]:].strip(" :#-	")
        return text if PHONE.search(text) else None
    if is_label(text) or len(text) > 60:
        return None
    return text


@dataclass
class Cand:
    value: str
    seg: Seg
    label: float


class TextLayerExtractor:
    name = "text-layer-v1"

    def __init__(self, weights: dict[str, float]):
        self.w = weights

    def extract(self, doc: Document, context: dict[str, str]) -> Extraction:
        with pymupdf.open(doc.path) as pdf:
            segs = [s for pno in doc.pages for s in segments(pdf[pno - 1], pno)]
        header_rows, items = self._line_items(segs)
        excluded = {id(s) for row in header_rows for s in row}
        searchable = [s for s in segs if id(s) not in excluded]
        cands = {f: self._single(f, searchable) for f in SINGLE_LINE}
        cands["remit_to"] = self._remit(searchable)
        cands["vendor_name"] = self._vendor(segs, doc.pages[0])
        fields = {}
        for f, cs in cands.items():
            fields[f] = self._choose(f, cs, items, fields, context)
        return Extraction(doc.doc_id, self.name, fields, items)

    # candidates -----------------------------------------------------------
    def _single(self, field: str, segs: list[Seg]) -> list[Cand]:
        out = []
        for s in segs:
            hit = match_label(field, s.text)
            if not hit:
                continue
            spec, end = hit
            options = []
            rest = s.text[end:]
            if rest.strip(" :#-\t"):
                options.append((rest, s, 1.0))
            right = nearest_right(s, segs)
            if right:
                options.append((right.text, right, 1.0))
            below = nearest_below(s, segs)
            if below:
                options.append((below.text, below, 0.9))
            for text, src, pos in options:
                value = _parse(field, text)
                if value is not None:
                    out.append(Cand(value, src, spec * pos))
                    break
        return out

    def _remit(self, segs: list[Seg]) -> list[Cand]:
        out = []
        for s in segs:
            hit = match_label("remit_to", s.text)
            if not hit:
                continue
            lines, parts, cur = [], [s], s
            rest = s.text[hit[1]:].strip(" :\t")
            if rest:
                lines.append(rest)
            for _ in range(3):
                nxt = nearest_below(cur, segs, aligned=True)
                if nxt is None or is_label(nxt.text):
                    break
                lines.append(nxt.text)
                parts.append(nxt)
                cur = nxt
            if lines:
                box = Seg(s.page, "", min(p.x0 for p in parts), min(p.y0 for p in parts),
                          max(p.x1 for p in parts), max(p.y1 for p in parts), s.size)
                out.append(Cand(", ".join(lines), box, hit[0]))
        return out

    def _vendor(self, segs: list[Seg], first_page: int) -> list[Cand]:
        top = [s for s in segs if s.page == first_page and s.y0 < 200 and s.size >= 11
               and not TITLE_WORDS.search(s.text) and not is_label(s.text) and re.search(r"[A-Za-z]", s.text)]
        top.sort(key=lambda s: -s.size)
        return [Cand(s.text, s, 1.0 if s.size >= 14 else 0.6) for s in top]

    # choice and confidence --------------------------------------------------
    def _choose(self, field, cands, items, fields, context) -> FieldValue:
        if not cands:
            return FieldValue(field, None)
        cands = sorted(cands, key=lambda c: -c.label)
        best = cands[0]
        if field == "vendor_name":
            sizes = sorted((c.seg.size for c in cands), reverse=True)
            margin = 1.0 if len(sizes) == 1 else (sizes[0] - sizes[1]) / sizes[0]
        else:
            second = next((c.label for c in cands[1:] if c.value != best.value), 0.0)
            margin = (best.label - second) / best.label if best.label else 0.0
        factors = {"label": round(best.label, 3), "format": 1.0,
                   "agreement": self._agreement(field, best.value, items, fields, context),
                   "margin": round(margin, 3)}
        conf = sum(self.w[k] * factors[k] for k in self.w)
        return FieldValue(field, best.value, best.seg.page, best.seg.bbox, round(conf, 4), factors)

    def _agreement(self, field, value, items, fields, context) -> float:
        if field == "invoice_number":
            return 1.0 if norm_id(value) and norm_id(value) in norm_id(context.get("subject", "")) else 0.5
        if field == "vendor_name":
            first = re.sub(r"[^a-z]", "", value.split()[0].lower())
            return 1.0 if first and first in context.get("sender", "").lower() else 0.5
        if field in ("total", "subtotal") and items:
            s = round(sum(li.amount for li in items if li.amount is not None), 2)
            if field == "subtotal":
                return 1.0 if abs(float(value) - s) < 0.01 else 0.0
            sub = fields.get("subtotal")
            tax = fields.get("tax")
            sub_v = float(sub.value) if sub and sub.value else s
            tax_v = float(tax.value) if tax and tax.value else 0.0
            return 1.0 if abs(sub_v + tax_v - float(value)) < 0.01 and abs(sub_v - s) < 0.01 else 0.0
        return 0.5

    # line items -------------------------------------------------------------
    def _line_items(self, segs: list[Seg]):
        header_rows, items, cols = [], [], None
        for row in rows_of(segs):
            roles = self._header_roles(row)
            if roles:
                cols = roles
                header_rows.append(row)
                continue
            if cols is None:
                continue
            if any(STOP_ROW.match(s.text) for s in row):
                cols = None
                continue
            cells: dict[str, str] = {}
            for s in row:
                role = self._column_for(s, cols)
                if role:
                    cells[role] = (cells.get(role, "") + " " + s.text).strip()
            desc = cells.get("desc", "")
            amount = parse_amount(cells.get("amount"))
            if desc and amount is not None:
                qty = cells.get("qty", "").replace(",", "")
                items.append(LineItem(desc, float(qty) if re.fullmatch(r"\d+(\.\d+)?", qty) else None,
                                      parse_amount(cells.get("unit")), amount))
        return header_rows, items

    @staticmethod
    def _header_roles(row: list[Seg]) -> dict[str, Seg] | None:
        roles: dict[str, Seg] = {}
        for s in row:
            for role, rx in COLUMN_ROLES:
                if role not in roles and rx.match(s.text.strip()):
                    roles[role] = s
                    break
        return roles if {"desc", "amount"} <= set(roles) and len(roles) >= 3 else None

    @staticmethod
    def _column_for(s: Seg, cols: dict[str, Seg]) -> str | None:
        if abs(s.x0 - cols["desc"].x0) <= 3:
            return "desc"
        centre = (s.x0 + s.x1) / 2
        return min(cols, key=lambda r: abs((cols[r].x0 + cols[r].x1) / 2 - centre))
```

Line items carry over across pages: when a continuation page repeats the header, `_header_roles` picks it up; when it does not, the previous `cols` stays in effect until a stop row.

- [ ] **Step 7: Run the tests; iterate on the dev set only**

Run: `python -m pytest tests/test_extract.py -q`
Expected: all pass. If a dev layout fails, print the segments (`[(s.text, s.bbox, s.size) for s in segs]`) for that layout and fix the lexicon or the geometry rule, not the test. Do not open held-out layouts while doing this.

- [ ] **Step 8: Commit**

```bash
git add poc/intake/intake/extract poc/intake/intake/config.py poc/intake/config/thresholds.yaml poc/intake/tests/test_extract.py
git commit -m "Extract invoice fields from the PDF text layer with confidence from visible factors"
```

---

### Task 5: Validation checklist and routing

**Files:**
- Create: `poc/intake/config/checklist.yaml`, `poc/intake/intake/validate.py`, `poc/intake/intake/score.py`
- Test: `poc/intake/tests/test_validate_score.py`

**Interfaces:**
- Consumes: `Config` (Task 4); `Document`, `Extraction`, `CheckResult`, `Assessment`, status constants (Task 1).
- Produces: `run_checks(doc, ex, checklist: dict, find_duplicate: Callable[[Document, Extraction], str | None], as_of: date) -> list[CheckResult]`; `assess(doc, ex, checks, cfg: Config) -> Assessment`.

- [ ] **Step 1: Write `config/checklist.yaml`**

```yaml
# DRAFT checklist based on the proper-invoice elements in FAR 32.905(b)(1).
# Our reading, to be replaced by ICE's own checklist in Phase 0. Citations to verify.
required:
  - {field: vendor_name,     code: MISSING_VENDOR_NAME,     label: "Contractor name",               far: "32.905(b)(1)(i)"}
  - {field: invoice_number,  code: MISSING_INVOICE_NUMBER,  label: "Invoice number",                far: "32.905(b)(1)(ii)"}
  - {field: invoice_date,    code: MISSING_INVOICE_DATE,    label: "Invoice date",                  far: "32.905(b)(1)(ii)"}
  - {field: contract_number, code: MISSING_CONTRACT_NUMBER, label: "Contract or order number",      far: "32.905(b)(1)(iii)"}
  - {field: line_items,      code: MISSING_LINE_ITEMS,      label: "Description, quantity and price", far: "32.905(b)(1)(iv)"}
  - {field: payment_terms,   code: MISSING_PAYMENT_TERMS,   label: "Payment terms",                 far: "32.905(b)(1)(v)"}
  - {field: remit_to,        code: MISSING_REMIT_TO,        label: "Remit-to name and address",     far: "32.905(b)(1)(vi)"}
  - {field: contact,         code: MISSING_CONTACT,         label: "Contact for a defective invoice", far: "32.905(b)(1)(vii)"}
  - {field: tin,             code: MISSING_TIN,             label: "Taxpayer identification number", far: "32.905(b)(1)(viii)"}
  - {field: total,           code: MISSING_TOTAL,           label: "Invoice total",                 far: "-"}
arithmetic_tolerance: 0.01
max_invoice_age_days: 365
```

- [ ] **Step 2: Write the failing tests**

```python
from datetime import date

from intake.config import load_config
from intake.models import ATTENTION, IMPROPER, READY, Document, Extraction, FieldValue, LineItem
from intake.score import assess
from intake.validate import run_checks

CFG = load_config()
DOC = Document("T-0-1", "T", 0, "t.pdf", "t.pdf", "sha", [1], "invoice")
AS_OF = date(2026, 10, 9)


def _ex(conf=0.95, **over):
    vals = dict(vendor_name="Contoso Facility Services", invoice_number="CF-1", invoice_date="2026-09-14",
                contract_number="SYN-26-C-01234", payment_terms="Net 30", remit_to="Contoso, PO Box 1",
                contact="Jordan Lee, (703) 555-0101", tin="00-1000001", subtotal="1025.00", tax="0.00",
                total="1025.00")
    vals.update(over)
    fields = {k: FieldValue(k, v, 1, (0, 0, 1, 1), conf if v else 0.0) for k, v in vals.items()}
    return Extraction("T-0-1", "test", fields, [LineItem("a", 2, 450.0, 900.0), LineItem("b", 10, 12.5, 125.0)])


def _run(ex, doc=DOC, dup=None):
    checks = run_checks(doc, ex, CFG.checklist, lambda d, e: dup, AS_OF)
    return checks, assess(doc, ex, checks, CFG)


def test_clean_invoice_is_ready():
    checks, a = _run(_ex())
    assert a.status == READY and not a.failed


def test_missing_required_element_is_likely_improper_with_reason():
    _, a = _run(_ex(contract_number=None))
    assert a.status == IMPROPER
    assert [c.code for c in a.failed] == ["MISSING_CONTRACT_NUMBER"]
    assert "32.905(b)(1)(iii)" in a.failed[0].message and "draft" in a.failed[0].message


def test_arithmetic_and_duplicate_and_credit_need_attention():
    assert _run(_ex(total="1125.00"))[1].failed[0].code == "ARITH_TOTAL"
    _, a = _run(_ex(), dup="D001-0-1")
    assert a.status == ATTENTION and a.failed[0].code == "DUPLICATE" and "D001-0-1" in a.failed[0].message
    credit = Document("T-0-1", "T", 0, "t.pdf", "t.pdf", "sha", [1], "credit_memo")
    assert "CREDIT_MEMO" in [c.code for c in _run(_ex(), doc=credit)[1].failed]


def test_low_confidence_needs_attention():
    assert _run(_ex(conf=0.6))[1].status == ATTENTION


def test_future_date_fails():
    assert "DATE_IN_FUTURE" in [c.code for c in _run(_ex(invoice_date="2026-12-01"))[1].failed]


def test_unreadable_document_needs_attention():
    doc = Document("T-0-0", "T", 0, "scan.pdf", "scan.pdf", "sha", [], "unreadable", "no text layer")
    ex = Extraction("T-0-0", "none", {}, [], has_text=False)
    checks, a = _run(ex, doc=doc)
    assert a.status == ATTENTION and a.failed[0].code == "UNREADABLE"
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `python -m pytest tests/test_validate_score.py -q`
Expected: `ModuleNotFoundError: No module named 'intake.validate'`.

- [ ] **Step 4: Write `intake/validate.py`**

```python
"""Runs the configurable checklist. Every failed check carries a reason code and a message."""
from __future__ import annotations

from datetime import date
from typing import Callable

from .models import CheckResult, Document, Extraction
from .normalize import parse_amount


def run_checks(doc: Document, ex: Extraction, checklist: dict,
               find_duplicate: Callable[[Document, Extraction], str | None], as_of: date) -> list[CheckResult]:
    if doc.kind == "unreadable" or not ex.has_text:
        return [CheckResult("UNREADABLE", False, f"Could not read the file: {doc.note or 'no text'}")]
    out: list[CheckResult] = []
    for req in checklist["required"]:
        f = req["field"]
        present = bool(ex.line_items) if f == "line_items" else bool(ex.value(f))
        where = f" (FAR {req['far']}, draft checklist)" if req["far"] != "-" else " (draft checklist)"
        out.append(CheckResult(req["code"], present,
                               f"{req['label']} {'found' if present else 'not found'}{where}", f))

    tol = checklist["arithmetic_tolerance"]
    total = parse_amount(ex.value("total"))
    if ex.line_items and total is not None:
        lines = round(sum(li.amount for li in ex.line_items if li.amount is not None), 2)
        sub = parse_amount(ex.value("subtotal"))
        sub = lines if sub is None else sub
        tax = parse_amount(ex.value("tax")) or 0.0
        ok = abs(sub - lines) <= tol and abs(sub + tax - total) <= tol
        out.append(CheckResult("ARITH_TOTAL", ok, "Line items, tax and total agree" if ok else
                               f"Line items ({lines:,.2f}) plus tax ({tax:,.2f}) do not equal the total "
                               f"({total:,.2f})", "total"))
        bad = [li.description for li in ex.line_items
               if li.quantity is not None and li.unit_price is not None and li.amount is not None
               and abs(abs(li.quantity * li.unit_price) - abs(li.amount)) > tol]
        out.append(CheckResult("LINE_EXTENSION", not bad,
                               "Quantity times unit price matches each line" if not bad else
                               f"Quantity times unit price does not match: {', '.join(bad)}", "line_items"))

    d = ex.value("invoice_date")
    if d:
        when = date.fromisoformat(d)
        out.append(CheckResult("DATE_IN_FUTURE", when <= as_of, f"Invoice date {d} is after {as_of}"
                               if when > as_of else "Invoice date is not in the future", "invoice_date"))
        too_old = (as_of - when).days > checklist["max_invoice_age_days"]
        out.append(CheckResult("DATE_TOO_OLD", not too_old, f"Invoice date {d} is more than "
                               f"{checklist['max_invoice_age_days']} days old" if too_old
                               else "Invoice date is recent", "invoice_date"))

    credit = doc.kind == "credit_memo" or (total is not None and total < 0)
    out.append(CheckResult("CREDIT_MEMO", not credit, "Credit memo: a technician decides how to apply it"
                           if credit else "Not a credit memo", "total"))
    dup = find_duplicate(doc, ex)
    out.append(CheckResult("DUPLICATE", dup is None, f"Possible duplicate of {dup}" if dup
                           else "No earlier copy found", "invoice_number"))
    return out
```

- [ ] **Step 5: Write `intake/score.py`**

```python
"""Turns check results and field confidence into a routing status."""
from __future__ import annotations

from .config import Config
from .models import ATTENTION, IMPROPER, READY, Assessment, CheckResult, Document, Extraction


def assess(doc: Document, ex: Extraction, checks: list[CheckResult], cfg: Config) -> Assessment:
    failed = [c for c in checks if not c.passed]
    confs = [ex.fields[f].confidence for f in cfg.required_fields
             if f in ex.fields and ex.fields[f].value]
    min_conf = round(min(confs), 4) if confs else 0.0
    if doc.kind == "unreadable" or not ex.has_text:
        status = ATTENTION
    elif any(c.code.startswith("MISSING_") for c in failed):
        status = IMPROPER
    elif failed or min_conf < cfg.thresholds["ready_min_confidence"]:
        status = ATTENTION
    else:
        status = READY
    return Assessment(doc.doc_id, status, checks, min_conf)
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `python -m pytest tests/test_validate_score.py -q`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add poc/intake/config/checklist.yaml poc/intake/intake/validate.py poc/intake/intake/score.py poc/intake/tests/test_validate_score.py
git commit -m "Check invoices against a draft FAR 32.905(b) checklist and route them by status"
```

---

### Task 6: Store with an append-only event log, and the mock FileOnQ record

**Files:**
- Create: `poc/intake/intake/store.py`, `poc/intake/intake/record.py`
- Test: `poc/intake/tests/test_store_record.py`

**Interfaces:**
- Consumes: models and `norm_id`, `compare_key` (Task 1).
- Produces:
  - `Store` protocol and `SqliteStore(path: Path)` with: `has_email(sha) -> bool`, `add_email(email, sha)`, `get_email(email_id) -> Email`, `add_document(doc)`, `get_document(doc_id) -> Document`, `list_documents() -> list[Document]`, `save_extraction(ex)`, `get_extraction(doc_id) -> Extraction | None`, `save_assessment(a)`, `get_assessment(doc_id) -> Assessment | None`, `save_decision(doc_id, decision, record_id, data: dict)`, `get_decision(doc_id) -> dict | None`, `append_event(kind, actor, doc_id, payload: dict, ts: str)`, `events(doc_id=None) -> list[dict]`, `find_duplicate(doc, ex) -> str | None`.
  - `IntakeRecord` dataclass; `SystemOfRecord` protocol with `create_record(record) -> str`; `MockFileOnQ(root: Path)`.

- [ ] **Step 1: Write the failing tests**

```python
import sqlite3

import pymupdf
import pytest

from intake.models import Document, Email, Extraction, FieldValue
from intake.record import IntakeRecord, MockFileOnQ
from intake.store import SqliteStore


def _doc(i, email="E1", sha="s1"):
    return Document(f"{email}-0-{i}", email, 0, "a.pdf", "a.pdf", sha, [i], "invoice")


def _ex(doc_id, inv="CF-1", total="10.00", vendor="Contoso"):
    f = {"vendor_name": FieldValue("vendor_name", vendor), "invoice_number": FieldValue("invoice_number", inv),
         "total": FieldValue("total", total)}
    return Extraction(doc_id, "t", f, [])


def test_events_are_append_only(tmp_path):
    s = SqliteStore(tmp_path / "i.db")
    s.append_event("received", "svc", "E1-0-1", {"a": 1}, "2026-10-09T00:00:00Z")
    with pytest.raises(sqlite3.DatabaseError, match="append-only"):
        s.conn.execute("UPDATE events SET kind='x'")
    with pytest.raises(sqlite3.DatabaseError, match="append-only"):
        s.conn.execute("DELETE FROM events")
    assert [e["kind"] for e in s.events("E1-0-1")] == ["received"]


def test_round_trip_and_email_idempotency(tmp_path):
    s = SqliteStore(tmp_path / "i.db")
    s.add_email(Email("E1", "a@b", "subj", "d", []), "sha1")
    assert s.has_email("sha1") and not s.has_email("sha2")
    s.add_document(_doc(1))
    s.save_extraction(_ex("E1-0-1"))
    assert s.get_document("E1-0-1").pages == [1]
    assert s.get_extraction("E1-0-1").value("invoice_number") == "CF-1"


def test_duplicate_by_fields_or_same_file_but_never_itself(tmp_path):
    s = SqliteStore(tmp_path / "i.db")
    first = _doc(1)
    s.add_document(first)
    s.save_extraction(_ex(first.doc_id))
    assert s.find_duplicate(first, _ex(first.doc_id)) is None
    resend = _doc(1, email="E2", sha="other")
    s.add_document(resend)
    assert s.find_duplicate(resend, _ex(resend.doc_id)) == first.doc_id
    same_file = _doc(1, email="E3", sha="s1")
    assert s.find_duplicate(same_file, _ex(same_file.doc_id, inv="ZZ-9")) == first.doc_id


def test_mock_fileonq_writes_record_and_pdf(tmp_path):
    pdf = pymupdf.open()
    for _ in range(3):
        pdf.new_page()
    src = tmp_path / "a.pdf"
    pdf.save(src)
    sor = MockFileOnQ(tmp_path / "records")
    rec = IntakeRecord("E1-0-2", {"invoice_number": "CF-1"}, [], str(src), [2, 3], "tech-1", "2026-10-09T00:00:00Z")
    rid = sor.create_record(rec)
    assert rid == "MOCK-000001"
    assert pymupdf.open(tmp_path / "records" / rid / "invoice.pdf").page_count == 2
    assert "MOCK" in (tmp_path / "records" / rid / "record.json").read_text()
    assert sor.create_record(rec) == "MOCK-000002"
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `python -m pytest tests/test_store_record.py -q`
Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Write `intake/store.py`**

```python
"""Persistence behind one interface. Locally SQLite; on a platform, tables in the
workspace or a managed database, with the event table append-only."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Protocol

from .models import (Assessment, Document, Email, Extraction, assessment_from_dict, document_from_dict,
                     extraction_from_dict, to_json, Attachment)
from .normalize import compare_key

SCHEMA = """
CREATE TABLE IF NOT EXISTS emails(email_id TEXT PRIMARY KEY, sha256 TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS documents(doc_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS extractions(doc_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assessments(doc_id TEXT PRIMARY KEY, status TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS decisions(doc_id TEXT PRIMARY KEY, decision TEXT NOT NULL, record_id TEXT,
                                     data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, actor TEXT NOT NULL,
                                  kind TEXT NOT NULL, doc_id TEXT, payload TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events
  BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events
  BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
"""


class Store(Protocol):
    def has_email(self, sha: str) -> bool: ...
    def add_email(self, email: Email, sha: str) -> None: ...
    def get_email(self, email_id: str) -> Email: ...
    def add_document(self, doc: Document) -> None: ...
    def get_document(self, doc_id: str) -> Document: ...
    def list_documents(self) -> list[Document]: ...
    def save_extraction(self, ex: Extraction) -> None: ...
    def get_extraction(self, doc_id: str) -> Extraction | None: ...
    def save_assessment(self, a: Assessment) -> None: ...
    def get_assessment(self, doc_id: str) -> Assessment | None: ...
    def save_decision(self, doc_id: str, decision: str, record_id: str | None, data: dict) -> None: ...
    def get_decision(self, doc_id: str) -> dict | None: ...
    def append_event(self, kind: str, actor: str, doc_id: str | None, payload: dict, ts: str) -> None: ...
    def events(self, doc_id: str | None = None) -> list[dict]: ...
    def find_duplicate(self, doc: Document, ex: Extraction) -> str | None: ...


class SqliteStore:
    def __init__(self, path: Path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
        self.conn.executescript(SCHEMA)

    def _one(self, sql, *args):
        row = self.conn.execute(sql, args).fetchone()
        return json.loads(row[0]) if row else None

    def has_email(self, sha):
        return self.conn.execute("SELECT 1 FROM emails WHERE sha256=?", (sha,)).fetchone() is not None

    def add_email(self, email, sha):
        self.conn.execute("INSERT INTO emails VALUES (?,?,?)", (email.email_id, sha, to_json(email)))

    def get_email(self, email_id):
        d = self._one("SELECT data FROM emails WHERE email_id=?", email_id)
        return Email(**{**d, "attachments": [Attachment(**a) for a in d["attachments"]]})

    def add_document(self, doc):
        self.conn.execute("INSERT OR REPLACE INTO documents VALUES (?,?)", (doc.doc_id, to_json(doc)))

    def get_document(self, doc_id):
        return document_from_dict(self._one("SELECT data FROM documents WHERE doc_id=?", doc_id))

    def list_documents(self):
        return [document_from_dict(json.loads(r[0]))
                for r in self.conn.execute("SELECT data FROM documents ORDER BY doc_id")]

    def save_extraction(self, ex):
        self.conn.execute("INSERT OR REPLACE INTO extractions VALUES (?,?)", (ex.doc_id, to_json(ex)))

    def get_extraction(self, doc_id):
        d = self._one("SELECT data FROM extractions WHERE doc_id=?", doc_id)
        return extraction_from_dict(d) if d else None

    def save_assessment(self, a):
        self.conn.execute("INSERT OR REPLACE INTO assessments VALUES (?,?,?)", (a.doc_id, a.status, to_json(a)))

    def get_assessment(self, doc_id):
        d = self._one("SELECT data FROM assessments WHERE doc_id=?", doc_id)
        return assessment_from_dict(d) if d else None

    def save_decision(self, doc_id, decision, record_id, data):
        self.conn.execute("INSERT INTO decisions VALUES (?,?,?,?)", (doc_id, decision, record_id, json.dumps(data)))

    def get_decision(self, doc_id):
        row = self.conn.execute("SELECT decision, record_id, data FROM decisions WHERE doc_id=?",
                                (doc_id,)).fetchone()
        return {"decision": row[0], "record_id": row[1], **json.loads(row[2])} if row else None

    def append_event(self, kind, actor, doc_id, payload, ts):
        self.conn.execute("INSERT INTO events(ts, actor, kind, doc_id, payload) VALUES (?,?,?,?,?)",
                          (ts, actor, kind, doc_id, json.dumps(payload, sort_keys=True)))

    def events(self, doc_id=None):
        sql = "SELECT seq, ts, actor, kind, doc_id, payload FROM events"
        rows = self.conn.execute(sql + (" WHERE doc_id=? ORDER BY seq" if doc_id else " ORDER BY seq"),
                                 (doc_id,) if doc_id else ()).fetchall()
        return [{"seq": r[0], "ts": r[1], "actor": r[2], "kind": r[3], "doc_id": r[4],
                 "payload": json.loads(r[5])} for r in rows]

    def find_duplicate(self, doc, ex):
        key = tuple(compare_key(f, ex.value(f)) for f in ("vendor_name", "invoice_number", "total"))
        for other in self.list_documents():
            if other.doc_id == doc.doc_id or other.kind not in ("invoice", "credit_memo"):
                continue
            if other.file_sha256 == doc.file_sha256 and other.email_id != doc.email_id \
                    and other.pages == doc.pages:
                return other.doc_id
            oex = self.get_extraction(other.doc_id)
            if oex and None not in key and \
                    tuple(compare_key(f, oex.value(f)) for f in ("vendor_name", "invoice_number", "total")) == key:
                return other.doc_id
        return None
```

Note: `find_duplicate` only returns documents stored before the current one is compared, because the pipeline saves the current extraction after validation. A test in Task 7 pins this.

- [ ] **Step 4: Write `intake/record.py`**

```python
"""The system-of-record boundary. The mock stands in for FileOnQ and defines OUR
record shape only. It makes no assumption about FileOnQ's interface, field names
or import formats; those are Phase 0 questions."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Protocol

import pymupdf


@dataclass
class IntakeRecord:
    doc_id: str
    fields: dict[str, str | None]
    line_items: list[dict]
    pdf_path: str
    pages: list[int]
    approved_by: str
    approved_at: str


class SystemOfRecord(Protocol):
    def create_record(self, record: IntakeRecord) -> str: ...


class MockFileOnQ:
    """MOCK. Writes record.json and invoice.pdf to a folder and returns an ID."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def create_record(self, record: IntakeRecord) -> str:
        n = len([p for p in self.root.iterdir() if p.is_dir() and p.name.startswith("MOCK-")]) + 1
        rid = f"MOCK-{n:06d}"
        folder = self.root / rid
        folder.mkdir()
        out = pymupdf.open()
        with pymupdf.open(record.pdf_path) as src:
            for p in record.pages:
                out.insert_pdf(src, from_page=p - 1, to_page=p - 1)
        out.save(folder / "invoice.pdf")
        payload = {"record_id": rid, "system": "MOCK FileOnQ (not the real interface)", **asdict(record)}
        (folder / "record.json").write_text(json.dumps(payload, indent=2))
        return rid
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `python -m pytest tests/test_store_record.py -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add poc/intake/intake/store.py poc/intake/intake/record.py poc/intake/tests/test_store_record.py
git commit -m "Store intake results with an append-only event log and add the mock FileOnQ record"
```

---

### Task 7: Pipeline and command line

**Files:**
- Create: `poc/intake/intake/pipeline.py`, `poc/intake/intake/cli.py`
- Test: `poc/intake/tests/test_pipeline.py`

**Interfaces:**
- Consumes: everything from Tasks 3 to 6.
- Produces: `run(inbox: Path, store: Store, extractor: Extractor, cfg: Config, work_dir: Path, as_of: date, clock=utc_now, actor="intake-service") -> RunResult` where `RunResult(emails: int, skipped: int, documents: list[str])`; `revalidate(store, doc_id, cfg, as_of) -> Assessment` (used by review in Task 9); CLI `python -m intake.cli run --inbox ... --db ...`.

- [ ] **Step 1: Write the failing tests**

```python
from datetime import date

from intake.config import load_config
from intake.extract.textlayer import TextLayerExtractor
from intake.models import IMPROPER
from intake.pipeline import run
from intake.store import SqliteStore
from synth.generate import build_set

CFG = load_config()


def _run(tmp_path, truth_dir, store):
    return run(truth_dir / "inbox", store, TextLayerExtractor(CFG.thresholds["weights"]), CFG,
               tmp_path / "work", date(2026, 10, 9))


def test_pipeline_processes_every_document_and_logs_events(tmp_path):
    truth = build_set("dev", tmp_path / "data")
    store = SqliteStore(tmp_path / "i.db")
    res = _run(tmp_path, tmp_path / "data", store)
    expected = {d["doc_id"] for t in truth for a in t["attachments"] for d in a["documents"]}
    assert set(res.documents) == expected
    kinds = {e["kind"] for e in store.events()}
    assert {"email_received", "document_identified", "extracted", "validated", "routed"} <= kinds


def test_rerun_is_idempotent(tmp_path):
    build_set("dev", tmp_path / "data")
    store = SqliteStore(tmp_path / "i.db")
    _run(tmp_path, tmp_path / "data", store)
    n_events = len(store.events())
    again = _run(tmp_path, tmp_path / "data", store)
    assert again.emails == 0 and again.skipped > 0 and again.documents == []
    assert len(store.events()) == n_events


def test_original_is_not_its_own_duplicate_but_resend_is(tmp_path):
    truth = build_set("dev", tmp_path / "data")
    store = SqliteStore(tmp_path / "i.db")
    _run(tmp_path, tmp_path / "data", store)
    resend = next(d for t in truth for a in t["attachments"] for d in a["documents"]
                  if "DUPLICATE" in d["expected_codes"])
    codes = [c.code for c in store.get_assessment(resend["doc_id"]).failed]
    assert "DUPLICATE" in codes
    for t in truth:
        for a in t["attachments"]:
            for d in a["documents"]:
                if d["kind"] == "invoice" and "DUPLICATE" not in d["expected_codes"]:
                    a_ = store.get_assessment(d["doc_id"])
                    assert "DUPLICATE" not in [c.code for c in a_.failed], d["doc_id"]


def test_missing_element_routes_likely_improper(tmp_path):
    truth = build_set("dev", tmp_path / "data")
    store = SqliteStore(tmp_path / "i.db")
    _run(tmp_path, tmp_path / "data", store)
    d = next(d for t in truth for a in t["attachments"] for d in a["documents"]
             if "MISSING_CONTRACT_NUMBER" in d["expected_codes"])
    assert store.get_assessment(d["doc_id"]).status == IMPROPER
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `python -m pytest tests/test_pipeline.py -q`
Expected: `ModuleNotFoundError: No module named 'intake.pipeline'`.

- [ ] **Step 3: Write `intake/pipeline.py`**

```python
"""Runs intake end to end over an inbox folder. Each stage is a plain function call,
so on a platform the same steps can run as job tasks over tables."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path

from .classify import split_and_classify
from .config import Config
from .extract.base import Extractor
from .ingest import read_email
from .models import Assessment, Extraction
from .score import assess
from .store import Store
from .validate import run_checks


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class RunResult:
    emails: int = 0
    skipped: int = 0
    documents: list[str] = field(default_factory=list)


def revalidate(store: Store, doc_id: str, cfg: Config, as_of: date) -> Assessment:
    doc = store.get_document(doc_id)
    ex = store.get_extraction(doc_id) or Extraction(doc_id, "none", {}, [], has_text=False)
    checks = run_checks(doc, ex, cfg.checklist, store.find_duplicate, as_of)
    a = assess(doc, ex, checks, cfg)
    store.save_assessment(a)
    return a


def run(inbox: Path, store: Store, extractor: Extractor, cfg: Config, work_dir: Path, as_of: date,
        clock=utc_now, actor: str = "intake-service") -> RunResult:
    result = RunResult()
    for path in sorted(Path(inbox).glob("*.eml")):
        email, sha = read_email(path, Path(work_dir) / "attachments")
        if store.has_email(sha):
            result.skipped += 1
            continue
        store.add_email(email, sha)
        result.emails += 1
        store.append_event("email_received", actor, None,
                           {"email_id": email.email_id, "subject": email.subject,
                            "attachments": [a.filename for a in email.attachments]}, clock())
        context = {"subject": email.subject, "sender": email.sender}
        for att in email.attachments:
            for doc in split_and_classify(att):
                store.add_document(doc)
                result.documents.append(doc.doc_id)
                store.append_event("document_identified", actor, doc.doc_id,
                                   {"kind": doc.kind, "pages": doc.pages, "note": doc.note}, clock())
                if doc.kind == "other":
                    continue
                if doc.kind == "unreadable":
                    ex = Extraction(doc.doc_id, "none", {}, [], has_text=False)
                else:
                    ex = extractor.extract(doc, context)
                    store.append_event("extracted", actor, doc.doc_id,
                                       {"extractor": ex.extractor,
                                        "fields": {k: {"value": f.value, "confidence": f.confidence}
                                                   for k, f in ex.fields.items()},
                                        "line_items": len(ex.line_items)}, clock())
                checks = run_checks(doc, ex, cfg.checklist, store.find_duplicate, as_of)
                store.save_extraction(ex)
                a = assess(doc, ex, checks, cfg)
                store.save_assessment(a)
                store.append_event("validated", actor, doc.doc_id,
                                   {"failed": [c.code for c in a.failed]}, clock())
                store.append_event("routed", actor, doc.doc_id,
                                   {"status": a.status, "min_required_confidence": a.min_required_confidence},
                                   clock())
    return result
```

- [ ] **Step 4: Write `intake/cli.py`**

```python
from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

from .config import load_config
from .extract.textlayer import TextLayerExtractor
from .pipeline import run
from .store import SqliteStore


def main() -> None:
    p = argparse.ArgumentParser(prog="intake")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="process an inbox folder of .eml files")
    r.add_argument("--inbox", required=True)
    r.add_argument("--db", default="out/intake.db")
    r.add_argument("--work", default="out/work")
    r.add_argument("--as-of", default=date.today().isoformat())
    e = sub.add_parser("evaluate", help="score a generated set against its ground truth")
    e.add_argument("--set", required=True, help="e.g. data/dev")
    e.add_argument("--report", required=True)
    e.add_argument("--work", default="out/eval")
    e.add_argument("--as-of", default="2026-10-09")
    args = p.parse_args()
    cfg = load_config()
    if args.cmd == "run":
        res = run(Path(args.inbox), SqliteStore(Path(args.db)), TextLayerExtractor(cfg.thresholds["weights"]),
                  cfg, Path(args.work), date.fromisoformat(args.as_of))
        print(f"{res.emails} emails processed, {res.skipped} already seen, {len(res.documents)} documents")
    else:
        from .evaluate import evaluate, write_report
        m = evaluate(Path(args.set), Path(args.work), cfg, date.fromisoformat(args.as_of))
        write_report(m, Path(args.report))
        print(f"report written to {args.report}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `python -m pytest tests/test_pipeline.py -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add poc/intake/intake/pipeline.py poc/intake/intake/cli.py poc/intake/tests/test_pipeline.py
git commit -m "Run intake end to end over an inbox folder with every step logged"
```

---

### Task 8: Metrics report against ground truth (end of increment a)

**Files:**
- Create: `poc/intake/intake/evaluate.py`, `poc/intake/README.md`, `poc/intake/reports/dev.md`, `poc/intake/reports/heldout.md` (generated)
- Modify: `poc/intake/EFFORT.md`
- Test: `poc/intake/tests/test_evaluate.py`

**Interfaces:**
- Consumes: `run`, `SqliteStore`, `TextLayerExtractor`, `compare_key`, `HEADER_FIELDS`.
- Produces: `evaluate(set_dir, work_dir, cfg, as_of) -> dict`; `write_report(metrics: dict, path: Path)`; `BANNER`.

- [ ] **Step 1: Write the failing tests**

```python
from datetime import date

from intake.config import load_config
from intake.evaluate import BANNER, evaluate, write_report
from synth.generate import build_set


def test_evaluate_reports_required_metrics(tmp_path):
    build_set("dev", tmp_path / "dev")
    m = evaluate(tmp_path / "dev", tmp_path / "work", load_config(), date(2026, 10, 9))
    for key in ("field_accuracy", "ready_share", "false_ready_rate", "improper_precision", "improper_recall",
                "calibration", "classification_accuracy", "split_accuracy", "status_confusion", "counts"):
        assert key in m
    assert 0 <= m["false_ready_rate"] <= 1
    assert set(m["field_accuracy"]) >= {"invoice_number", "total", "invoice_date"}


def test_report_carries_the_synthetic_banner_and_gaps(tmp_path):
    build_set("heldout", tmp_path / "h")
    m = evaluate(tmp_path / "h", tmp_path / "work", load_config(), date(2026, 10, 9))
    out = tmp_path / "r.md"
    write_report(m, out)
    text = out.read_text()
    assert text.startswith("# ") and BANNER in text
    assert "No scanned invoices" in text and "reviewer minutes" in text.lower()
    for banned in ("learns as it goes", "immutable", "self-learning", "very easily"):
        assert banned not in text.lower()
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `python -m pytest tests/test_evaluate.py -q`
Expected: `ModuleNotFoundError: No module named 'intake.evaluate'`.

- [ ] **Step 3: Write `intake/evaluate.py`**

```python
"""Scores a generated set against its ground truth and writes the metrics report."""
from __future__ import annotations

import json
import shutil
from collections import Counter
from datetime import date
from pathlib import Path

from .config import Config
from .extract.textlayer import TextLayerExtractor
from .models import ATTENTION, HEADER_FIELDS, IMPROPER, READY, STATUS_LABELS
from .normalize import compare_key
from .pipeline import run
from .store import SqliteStore

BANNER = ("Synthetic data, born-digital PDFs only. These results are an upper bound, "
          "not a forecast for ICE's invoices.")
BANDS = [(0.0, 0.5), (0.5, 0.7), (0.7, 0.8), (0.8, 0.9), (0.9, 1.01)]


def _truth(set_dir: Path) -> list[dict]:
    return [json.loads(p.read_text()) for p in sorted((set_dir / "truth").glob("*.json"))]


def evaluate(set_dir: Path, work_dir: Path, cfg: Config, as_of: date) -> dict:
    set_dir, work_dir = Path(set_dir), Path(work_dir) / Path(set_dir).name
    shutil.rmtree(work_dir, ignore_errors=True)
    store = SqliteStore(work_dir / "eval.db")
    run(set_dir / "inbox", store, TextLayerExtractor(cfg.thresholds["weights"]), cfg, work_dir, as_of)
    predicted = {d.doc_id: d for d in store.list_documents()}

    field_hits: dict[str, list[int]] = {f: [] for f in HEADER_FIELDS}
    calib = [[0, 0] for _ in BANDS]
    kind_ok = kind_n = split_ok = split_n = 0
    confusion: Counter = Counter()
    ready = false_ready = 0
    tp = fp = fn = 0
    line_ok = line_n = 0
    invoices = 0
    layouts = Counter()

    for t in _truth(set_dir):
        for att in t["attachments"]:
            truth_ranges = [d["pages"] for d in att["documents"]]
            pred_ranges = [d.pages for d in predicted.values()
                           if d.email_id == t["email_id"] and d.attachment_index == att["index"]]
            split_n += 1
            split_ok += sorted(truth_ranges) == sorted(pred_ranges)
            for d in att["documents"]:
                kind_n += 1
                p = predicted.get(d["doc_id"])
                kind_ok += bool(p and p.kind == d["kind"])
                if d["kind"] not in ("invoice", "credit_memo") or not p:
                    continue
                invoices += 1
                layouts[t["layout_id"]] += 1
                ex = store.get_extraction(d["doc_id"])
                a = store.get_assessment(d["doc_id"])
                wrong_required = False
                for f in HEADER_FIELDS:
                    fv = ex.fields.get(f) if ex else None
                    ok = compare_key(f, fv.value if fv else None) == compare_key(f, d["fields"].get(f))
                    field_hits[f].append(int(ok))
                    if f in cfg.required_fields and not ok:
                        wrong_required = True
                    if fv and fv.value is not None:
                        for i, (lo, hi) in enumerate(BANDS):
                            if lo <= fv.confidence < hi:
                                calib[i][0] += 1
                                calib[i][1] += int(ok)
                if ex:
                    line_n += 1
                    line_ok += [round(li.amount, 2) for li in ex.line_items] == \
                               [round(li["amount"], 2) for li in d["line_items"]]
                status = a.status if a else "none"
                confusion[(d["expected_status"], status)] += 1
                if status == READY:
                    ready += 1
                    false_ready += int(wrong_required or d["expected_status"] != READY)
                is_imp, should = status == IMPROPER, d["expected_status"] == IMPROPER
                tp += is_imp and should
                fp += is_imp and not should
                fn += should and not is_imp

    return {
        "set": set_dir.name,
        "held_out": set_dir.name == "heldout",
        "counts": {"emails": len(_truth(set_dir)), "invoices": invoices, "layouts": dict(layouts)},
        "field_accuracy": {f: (sum(h) / len(h) if h else None, len(h)) for f, h in field_hits.items()},
        "line_items_exact": (line_ok / line_n if line_n else None, line_n),
        "classification_accuracy": kind_ok / kind_n if kind_n else None,
        "split_accuracy": split_ok / split_n if split_n else None,
        "ready_share": ready / invoices if invoices else 0.0,
        "false_ready_rate": false_ready / ready if ready else 0.0,
        "ready_count": ready,
        "improper_precision": tp / (tp + fp) if tp + fp else None,
        "improper_recall": tp / (tp + fn) if tp + fn else None,
        "calibration": [{"band": f"{lo:.1f}-{min(hi, 1.0):.1f}", "n": n, "accuracy": (k / n if n else None)}
                        for (lo, hi), (n, k) in zip(BANDS, calib)],
        "status_confusion": {f"{e}->{p}": n for (e, p), n in sorted(confusion.items())},
    }


def _pct(x) -> str:
    return "n/a" if x is None else f"{x * 100:.1f}%"


def write_report(m: dict, path: Path) -> None:
    title = "Held-out layouts" if m["held_out"] else "Development layouts"
    lines = [
        f"# Intake proof of concept: metrics, {title.lower()}",
        "",
        f"> **{BANNER}**",
        "",
        f"Set: `{m['set']}`. {m['counts']['emails']} emails, {m['counts']['invoices']} invoices and credit memos. "
        f"Layouts: {', '.join(sorted(m['counts']['layouts']))}. "
        + ("These layouts were never used to tune extraction." if m["held_out"]
           else "Extraction was tuned on these layouts, so expect these numbers to be higher than held-out."),
        "",
        "## Routing",
        "",
        "| Measure | Result |",
        "|---|---|",
        f"| Invoices routed *{STATUS_LABELS[READY]}* | {_pct(m['ready_share'])} ({m['ready_count']}) |",
        f"| **Of those, wrongly marked ready** (gating measure) | **{_pct(m['false_ready_rate'])}** |",
        f"| *{STATUS_LABELS[IMPROPER]}* precision | {_pct(m['improper_precision'])} |",
        f"| *{STATUS_LABELS[IMPROPER]}* recall | {_pct(m['improper_recall'])} |",
        f"| Document type correct (invoice, credit memo, other) | {_pct(m['classification_accuracy'])} |",
        f"| Attachments split into the right documents | {_pct(m['split_accuracy'])} |",
        "",
        "## Field accuracy",
        "",
        "| Field | Exactly right | Invoices |",
        "|---|---|---|",
    ]
    for f, (acc, n) in m["field_accuracy"].items():
        lines.append(f"| {f} | {_pct(acc)} | {n} |")
    acc, n = m["line_items_exact"]
    lines += [f"| line items (all amounts) | {_pct(acc)} | {n} |", "",
              "## Calibration", "",
              "Of the field values given a confidence in each band, the share that were right.", "",
              "| Confidence | Values | Right |", "|---|---|---|"]
    for c in m["calibration"]:
        lines.append(f"| {c['band']} | {c['n']} | {_pct(c['accuracy'])} |")
    lines += ["", "## Expected status → routed status", "", "| Expected → routed | Invoices |", "|---|---|"]
    for k, v in m["status_confusion"].items():
        lines.append(f"| {k} | {v} |")
    lines += [
        "",
        "## What these numbers do not cover",
        "",
        "- **No scanned invoices.** Only PDFs with a text layer were tested. Scanned or photographed invoices "
        "need an OCR or model-based extractor behind the same interface.",
        "- **No reviewer minutes per invoice.** That needs timed sessions with ICE technicians (Phase 2).",
        "- **Synthetic vendors and layouts.** The same team wrote the layouts and the extractor. Held-out layouts "
        "reduce that bias but do not remove it. ICE's real vendor mix is unknown until Phase 0.",
        "- **Draft checklist.** Required elements follow a draft reading of FAR 32.905(b), not ICE's checklist.",
        "",
    ]
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text("\n".join(lines), encoding="utf-8")
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `python -m pytest tests/test_evaluate.py -q`
Expected: all pass.

- [ ] **Step 5: Generate both reports, held-out last and once**

```bash
python -m intake.cli evaluate --set data/dev --report reports/dev.md
python -m intake.cli evaluate --set data/heldout --report reports/heldout.md
```
Read both reports. Do not change the extractor in response to held-out results. If a fix is warranted, record it as a finding instead: once the extractor is changed because of these layouts, they are no longer unseen, and a new held-out set would be needed to re-measure.

- [ ] **Step 6: Write `poc/intake/README.md`**

Contents (prose, no banned phrases):
1. What it is: internal proof of concept for ICE OFM AP invoice intake on synthetic data, built to inform the plan, CONOPS and estimate. Not a client demo.
2. The banner sentence.
3. How to run: `pip install -e .[test]`, `python -m synth.generate --out data`, `python -m intake.cli run --inbox data/dev/inbox`, `python -m intake.cli evaluate ...`, `python -m pytest`.
4. Flow diagram (the eight steps).
5. Platform mapping table (local / Databricks / Azure), copied from design §3, with "which services ICE's authorization covers is a Phase 0 question".
6. What is real and what is a mock: extraction, checks, confidence, audit log are real code; FileOnQ is a mock; inbox is a folder; nothing connects to ICE.
7. Headline results: link to `reports/dev.md` and `reports/heldout.md`, quoting the false-ready rate and the held-out field accuracy range, with the banner.
8. Known gaps (from the report).

- [ ] **Step 7: Update `EFFORT.md`** with the end time and hours for increment (a).

- [ ] **Step 8: Run the full suite, commit and push**

```bash
python -m pytest -q
git add poc/intake
git commit -m "Score the intake proof of concept against ground truth and publish the dev and held-out reports"
git push origin claude/demo-review-poc-scope-okucbe
```

---

## Increment (b)

### Task 9: Review actions and the drafted rejection notice

**Files:**
- Create: `poc/intake/intake/review.py`
- Test: `poc/intake/tests/test_review.py`

**Interfaces:**
- Consumes: `Store`, `SystemOfRecord`, `IntakeRecord`, `revalidate` (Task 7), `Config`.
- Produces: `ReviewError`; `REASON_CODES: dict[str, str]`; `correct(store, doc_id, field, new_value, actor, cfg, as_of, clock) -> Assessment`; `approve(store, sor, doc_id, actor, clock) -> str`; `reject(store, doc_id, reason_code, actor, clock, note="") -> str` (returns the drafted notice); `draft_notice(store, doc_id, reason_code, note) -> str`.

- [ ] **Step 1: Write the failing tests**

```python
from datetime import date

import pytest

from intake.config import load_config
from intake.extract.textlayer import TextLayerExtractor
from intake.models import IMPROPER
from intake.pipeline import run
from intake.record import MockFileOnQ
from intake.review import ReviewError, approve, correct, reject
from intake.store import SqliteStore
from synth.generate import build_set

CFG = load_config()
AS_OF = date(2026, 10, 9)
CLOCK = lambda: "2026-10-09T15:00:00+00:00"


@pytest.fixture
def env(tmp_path):
    truth = build_set("dev", tmp_path / "data")
    store = SqliteStore(tmp_path / "i.db")
    run(tmp_path / "data" / "inbox", store, TextLayerExtractor(CFG.thresholds["weights"]), CFG,
        tmp_path / "work", AS_OF)
    docs = [d for t in truth for a in t["attachments"] for d in a["documents"]]
    return store, MockFileOnQ(tmp_path / "records"), docs


def test_correction_is_logged_with_old_and_new_and_rechecked(env):
    store, _, docs = env
    d = next(d for d in docs if "MISSING_CONTRACT_NUMBER" in d["expected_codes"])
    assert store.get_assessment(d["doc_id"]).status == IMPROPER
    a = correct(store, d["doc_id"], "contract_number", "SYN-26-C-55555", "tech-1", CFG, AS_OF, CLOCK)
    assert a.status != IMPROPER
    ev = [e for e in store.events(d["doc_id"]) if e["kind"] == "field_corrected"][0]
    assert ev["actor"] == "tech-1" and ev["payload"]["old"] is None and ev["payload"]["new"] == "SYN-26-C-55555"


def test_approve_creates_mock_record_once(env):
    store, sor, docs = env
    d = next(d for d in docs if d["expected_status"] == "ready")
    rid = approve(store, sor, d["doc_id"], "tech-1", CLOCK)
    assert rid.startswith("MOCK-")
    assert store.get_decision(d["doc_id"])["record_id"] == rid
    with pytest.raises(ReviewError, match="already"):
        approve(store, sor, d["doc_id"], "tech-1", CLOCK)


def test_approve_refused_while_a_required_element_is_missing(env):
    store, sor, docs = env
    d = next(d for d in docs if "MISSING_REMIT_TO" in d["expected_codes"])
    with pytest.raises(ReviewError, match="Remit-to"):
        approve(store, sor, d["doc_id"], "tech-1", CLOCK)


def test_reject_drafts_a_notice_that_is_not_sent(env):
    store, _, docs = env
    d = next(d for d in docs if "MISSING_INVOICE_DATE" in d["expected_codes"])
    notice = reject(store, d["doc_id"], "MISSING_INVOICE_DATE", "tech-1", CLOCK)
    assert notice.startswith("DRAFT - not sent")
    assert "Invoice date" in notice and d["fields"]["invoice_number"] in notice
    assert store.get_decision(d["doc_id"])["decision"] == "rejected"
    with pytest.raises(ReviewError):
        reject(store, d["doc_id"], "BOGUS", "tech-1", CLOCK)
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `python -m pytest tests/test_review.py -q`
Expected: `ModuleNotFoundError: No module named 'intake.review'`.

- [ ] **Step 3: Write `intake/review.py`**

```python
"""Technician actions. Every action is logged; nothing is sent to vendors."""
from __future__ import annotations

from datetime import date

from .config import Config
from .models import Assessment, FieldValue, LineItem
from .pipeline import revalidate
from .record import IntakeRecord, SystemOfRecord
from .store import Store


class ReviewError(Exception):
    pass


REASON_CODES = {
    "MISSING_VENDOR_NAME": "Contractor name is missing",
    "MISSING_INVOICE_NUMBER": "Invoice number is missing",
    "MISSING_INVOICE_DATE": "Invoice date is missing",
    "MISSING_CONTRACT_NUMBER": "Contract or order number is missing",
    "MISSING_LINE_ITEMS": "Description, quantity and price are missing",
    "MISSING_PAYMENT_TERMS": "Payment terms are missing",
    "MISSING_REMIT_TO": "Remit-to name and address are missing",
    "MISSING_CONTACT": "Contact for a defective invoice is missing",
    "MISSING_TIN": "Taxpayer identification number is missing",
    "ARITH_TOTAL": "Line items, tax and total do not agree",
    "DUPLICATE": "This invoice appears to have been submitted already",
    "NOT_AN_INVOICE": "The document is not an invoice",
    "OTHER": "Other (see note)",
}


def _undecided(store: Store, doc_id: str) -> None:
    d = store.get_decision(doc_id)
    if d:
        raise ReviewError(f"{doc_id} was already {d['decision']}")


def correct(store: Store, doc_id: str, field: str, new_value: str, actor: str, cfg: Config, as_of: date,
            clock) -> Assessment:
    _undecided(store, doc_id)
    ex = store.get_extraction(doc_id)
    old = ex.fields.get(field)
    ex.fields[field] = FieldValue(field, new_value.strip() or None, old.page if old else None,
                                  old.bbox if old else None, 1.0, {"corrected_by_reviewer": 1.0})
    store.save_extraction(ex)
    store.append_event("field_corrected", actor, doc_id,
                       {"field": field, "old": old.value if old else None, "new": new_value}, clock())
    a = revalidate(store, doc_id, cfg, as_of)
    store.append_event("routed", actor, doc_id, {"status": a.status, "after": "correction"}, clock())
    return a


def approve(store: Store, sor: SystemOfRecord, doc_id: str, actor: str, clock) -> str:
    _undecided(store, doc_id)
    a = store.get_assessment(doc_id)
    missing = [c for c in a.failed if c.code.startswith("MISSING_") or c.code == "UNREADABLE"]
    if missing:
        raise ReviewError("Cannot approve until fixed: " + "; ".join(c.message for c in missing))
    doc, ex = store.get_document(doc_id), store.get_extraction(doc_id)
    ts = clock()
    rec = IntakeRecord(doc_id, {k: f.value for k, f in ex.fields.items()},
                       [vars(li) for li in ex.line_items], doc.path, doc.pages, actor, ts)
    rid = sor.create_record(rec)
    store.save_decision(doc_id, "approved", rid, {"by": actor, "at": ts, "status_at_approval": a.status})
    store.append_event("approved", actor, doc_id, {"record_id": rid, "status_at_approval": a.status,
                                                   "open_checks": [c.code for c in a.failed]}, ts)
    return rid


def draft_notice(store: Store, doc_id: str, reason_code: str, note: str = "") -> str:
    ex = store.get_extraction(doc_id)
    a = store.get_assessment(doc_id)
    vendor = (ex.value("vendor_name") if ex else None) or "Vendor"
    number = (ex.value("invoice_number") if ex else None) or "(no invoice number)"
    problems = [c.message for c in (a.failed if a else [])] or [REASON_CODES[reason_code]]
    body = [
        "DRAFT - not sent. A technician reviews and sends this from the AP mailbox.",
        "",
        f"To: {vendor}",
        f"Re: Invoice {number}",
        "",
        "We are returning this invoice because it cannot be processed as submitted:",
        "",
        *[f"- {p}" for p in problems],
        "",
        f"Reason: {REASON_CODES[reason_code]}",
    ]
    if note:
        body += ["", f"Note: {note}"]
    body += ["", "Please send a corrected invoice to the same mailbox."]
    return "\n".join(body)


def reject(store: Store, doc_id: str, reason_code: str, actor: str, clock, note: str = "") -> str:
    _undecided(store, doc_id)
    if reason_code not in REASON_CODES:
        raise ReviewError(f"Unknown reason code {reason_code}")
    notice = draft_notice(store, doc_id, reason_code, note)
    ts = clock()
    store.save_decision(doc_id, "rejected", None, {"by": actor, "at": ts, "reason": reason_code,
                                                   "note": note, "notice": notice})
    store.append_event("rejected", actor, doc_id, {"reason": reason_code, "note": note}, ts)
    return notice
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `python -m pytest tests/test_review.py -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add poc/intake/intake/review.py poc/intake/tests/test_review.py
git commit -m "Add technician approve, correct and reject actions with a drafted rejection notice"
```

---

### Task 10: Review screen

**Files:**
- Create: `poc/intake/app/__init__.py`, `poc/intake/app/templates/base.html`, `queue.html`, `doc.html`
- Modify: `poc/intake/README.md` (how to start the app), `poc/intake/EFFORT.md`
- Test: `poc/intake/tests/test_app.py`

**Interfaces:**
- Consumes: `SqliteStore`, `MockFileOnQ`, `review.*`, `load_config`, `STATUS_LABELS`.
- Produces: `create_app(db: Path, records: Path, actor: str = "reviewer-1", as_of: date | None = None) -> Flask`; run with `flask --app "app:create_app('out/intake.db','out/records')" run`.

- [ ] **Step 1: Write the failing tests**

```python
from datetime import date

import pytest

from app import create_app
from intake.config import load_config
from intake.extract.textlayer import TextLayerExtractor
from intake.pipeline import run
from intake.store import SqliteStore
from synth.generate import build_set

CFG = load_config()


@pytest.fixture
def client(tmp_path):
    truth = build_set("dev", tmp_path / "data")
    db = tmp_path / "i.db"
    run(tmp_path / "data" / "inbox", SqliteStore(db), TextLayerExtractor(CFG.thresholds["weights"]), CFG,
        tmp_path / "work", date(2026, 10, 9))
    app = create_app(db, tmp_path / "records", as_of=date(2026, 10, 9))
    app.config["TESTING"] = True
    docs = [d for t in truth for a in t["attachments"] for d in a["documents"]]
    return app.test_client(), docs


def test_every_page_has_the_banner(client):
    c, docs = client
    for url in ("/", f"/doc/{docs[0]['doc_id']}"):
        html = c.get(url).get_data(as_text=True)
        assert "Synthetic data" in html and "FileOnQ is a mock" in html


def test_queue_groups_by_status(client):
    html = client[0].get("/").get_data(as_text=True)
    for label in ("Ready for review", "Needs attention", "Likely improper", "Other documents"):
        assert label in html


def test_doc_page_shows_fields_sources_and_page_image(client):
    c, docs = client
    d = next(d for d in docs if d["kind"] == "invoice")
    html = c.get(f"/doc/{d['doc_id']}").get_data(as_text=True)
    assert d["fields"]["invoice_number"] in html
    assert 'id="src-invoice_number"' in html and 'href="#src-invoice_number"' in html
    assert c.get(f"/doc/{d['doc_id']}/page/{d['pages'][0]}.png").mimetype == "image/png"


def test_approve_then_audit_trail_shows_it(client):
    c, docs = client
    d = next(d for d in docs if d["expected_status"] == "ready")
    r = c.post(f"/doc/{d['doc_id']}/approve", follow_redirects=True)
    html = r.get_data(as_text=True)
    assert "MOCK-000001" in html and "approved" in html


def test_approve_refusal_is_shown_not_crashed(client):
    c, docs = client
    d = next(d for d in docs if "MISSING_REMIT_TO" in d["expected_codes"])
    r = c.post(f"/doc/{d['doc_id']}/approve", follow_redirects=True)
    assert r.status_code == 200 and "Cannot approve" in r.get_data(as_text=True)


def test_reject_shows_draft_notice(client):
    c, docs = client
    d = next(d for d in docs if "MISSING_INVOICE_DATE" in d["expected_codes"])
    r = c.post(f"/doc/{d['doc_id']}/reject", data={"reason": "MISSING_INVOICE_DATE", "note": ""},
               follow_redirects=True)
    assert "DRAFT - not sent" in r.get_data(as_text=True)
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `python -m pytest tests/test_app.py -q`
Expected: `ModuleNotFoundError: No module named 'app'`.

- [ ] **Step 3: Write `app/__init__.py`**

```python
"""Technician review screen. A small Flask app, the kind either platform can host."""
from __future__ import annotations

from datetime import date
from pathlib import Path

import pymupdf
from flask import Flask, Response, abort, flash, redirect, render_template, request, url_for

from intake.config import load_config
from intake.models import ATTENTION, IMPROPER, READY, STATUS_LABELS
from intake.pipeline import utc_now
from intake.record import MockFileOnQ
from intake.review import REASON_CODES, ReviewError, approve, correct, reject
from intake.store import SqliteStore

ZOOM = 1.5
EDITABLE = ("vendor_name", "invoice_number", "invoice_date", "contract_number", "payment_terms",
            "remit_to", "contact", "tin", "subtotal", "tax", "total")


def create_app(db: Path, records: Path, actor: str = "reviewer-1", as_of: date | None = None) -> Flask:
    app = Flask(__name__)
    app.secret_key = "local-proof-of-concept-only"
    store = SqliteStore(Path(db))
    sor = MockFileOnQ(Path(records))
    cfg = load_config()
    today = as_of or date.today()

    @app.get("/")
    def queue():
        groups = {READY: [], ATTENTION: [], IMPROPER: [], "other": [], "decided": []}
        for d in store.list_documents():
            dec = store.get_decision(d.doc_id)
            a = store.get_assessment(d.doc_id)
            ex = store.get_extraction(d.doc_id)
            row = {"doc": d, "a": a, "ex": ex, "dec": dec}
            if dec:
                groups["decided"].append(row)
            elif d.kind == "other":
                groups["other"].append(row)
            elif a:
                groups[a.status].append(row)
        return render_template("queue.html", groups=groups, labels=STATUS_LABELS)

    @app.get("/doc/<doc_id>")
    def doc(doc_id):
        d = store.get_document(doc_id)
        if d is None:
            abort(404)
        return render_template("doc.html", d=d, a=store.get_assessment(doc_id), ex=store.get_extraction(doc_id),
                               dec=store.get_decision(doc_id), events=store.events(doc_id), zoom=ZOOM,
                               editable=EDITABLE, reasons=REASON_CODES, labels=STATUS_LABELS)

    @app.get("/doc/<doc_id>/page/<int:pno>.png")
    def page_png(doc_id, pno):
        d = store.get_document(doc_id)
        if pno not in d.pages:
            abort(404)
        with pymupdf.open(d.path) as pdf:
            png = pdf[pno - 1].get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM)).tobytes("png")
        return Response(png, mimetype="image/png")

    def _act(doc_id, fn):
        try:
            msg = fn()
            if msg:
                flash(msg)
        except ReviewError as e:
            flash(str(e))
        return redirect(url_for("doc", doc_id=doc_id))

    @app.post("/doc/<doc_id>/correct")
    def do_correct(doc_id):
        f, v = request.form["field"], request.form["value"]
        return _act(doc_id, lambda: correct(store, doc_id, f, v, actor, cfg, today, utc_now) and
                    f"Corrected {f}; checks re-run.")

    @app.post("/doc/<doc_id>/approve")
    def do_approve(doc_id):
        return _act(doc_id, lambda: f"Approved. Mock record {approve(store, sor, doc_id, actor, utc_now)} created.")

    @app.post("/doc/<doc_id>/reject")
    def do_reject(doc_id):
        return _act(doc_id, lambda: (reject(store, doc_id, request.form["reason"], actor, utc_now,
                                            request.form.get("note", "")) and "Rejected. Notice drafted below."))

    return app
```

- [ ] **Step 4: Write the templates**

`app/templates/base.html`:
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{% block title %}Invoice intake{% endblock %} · proof of concept</title>
<style>
  :root { --ink:#1b1f24; --muted:#555d66; --line:#d0d5db; --ready:#1d6b3a; --attn:#8a5a00; --imp:#a3262d; --hl:#ffd54a; }
  body { font: 16px/1.45 system-ui, sans-serif; color: var(--ink); margin: 0; background: #fff; }
  .banner { background:#1b1f24; color:#fff; padding:8px 16px; font-weight:600; }
  main { padding: 16px; max-width: 1400px; margin: auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid var(--line); padding: 6px 8px; text-align: left; vertical-align: top; }
  .pill { padding: 2px 8px; border-radius: 10px; font-size: 14px; color:#fff; white-space: nowrap; }
  .ready { background: var(--ready); } .needs_attention { background: var(--attn); } .likely_improper { background: var(--imp); }
  .flash { background:#eef4ff; border:1px solid #9bb7e8; padding:8px 12px; margin-bottom:12px; white-space: pre-wrap; }
  .muted { color: var(--muted); }
  a { color: #0b57d0; }
</style>
</head>
<body>
<div class="banner" role="note">Synthetic data — illustrative. FileOnQ is a mock. Nothing here connects to ICE systems.</div>
<main>
{% with msgs = get_flashed_messages() %}{% for m in msgs %}<div class="flash" role="status">{{ m }}</div>{% endfor %}{% endwith %}
{% block body %}{% endblock %}
</main>
</body>
</html>
```

`app/templates/queue.html`:
```html
{% extends "base.html" %}
{% block body %}
<h1>Invoice intake queue</h1>
{% for key, title in [("ready", labels["ready"]), ("needs_attention", labels["needs_attention"]),
                      ("likely_improper", labels["likely_improper"]), ("other", "Other documents"),
                      ("decided", "Decided")] %}
<h2>{{ title }} <span class="muted">({{ groups[key]|length }})</span></h2>
{% if groups[key] %}
<table>
<thead><tr><th>Document</th><th>Vendor</th><th>Invoice</th><th>Total</th><th>Lowest required confidence</th><th>Open checks</th></tr></thead>
<tbody>
{% for r in groups[key] %}
<tr>
  <td><a href="{{ url_for('doc', doc_id=r.doc.doc_id) }}">{{ r.doc.doc_id }}</a><br><span class="muted">{{ r.doc.kind }}</span></td>
  <td>{{ r.ex.value('vendor_name') if r.ex else '' }}</td>
  <td>{{ r.ex.value('invoice_number') if r.ex else '' }}</td>
  <td>{{ r.ex.value('total') if r.ex else '' }}</td>
  <td>{{ '%.0f%%'|format(r.a.min_required_confidence * 100) if r.a else '' }}</td>
  <td>{% if r.dec %}{{ r.dec.decision }}{% if r.dec.record_id %} ({{ r.dec.record_id }}){% endif %}
      {% elif r.a %}{{ r.a.failed|map(attribute='code')|join(', ') }}{% else %}{{ r.doc.note }}{% endif %}</td>
</tr>
{% endfor %}
</tbody></table>
{% endif %}
{% endfor %}
{% endblock %}
```

`app/templates/doc.html`:
```html
{% extends "base.html" %}
{% block title %}{{ d.doc_id }}{% endblock %}
{% block body %}
<style>
  .grid { display: grid; grid-template-columns: minmax(0, 960px) minmax(360px, 1fr); gap: 20px; }
  .page { position: relative; border: 1px solid var(--line); margin-bottom: 12px; width: max-content; }
  .page img { display: block; }
  .src { position: absolute; border: 2px solid transparent; }
  .src:target { border-color: #d93025; background: rgba(255, 213, 74, .35); }
  input[type=text] { width: 100%; font: inherit; }
  .low { color: var(--imp); font-weight: 600; }
  pre { white-space: pre-wrap; background: #f6f8fa; padding: 8px; }
  @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
</style>
<p><a href="{{ url_for('queue') }}">← Queue</a></p>
<h1>{{ d.doc_id }} <span class="muted">{{ d.filename }}, pages {{ d.pages|join(', ') }}</span></h1>
{% if a %}<p><span class="pill {{ a.status }}">{{ labels[a.status] }}</span>
  Lowest required-field confidence: {{ '%.0f%%'|format(a.min_required_confidence * 100) }}</p>{% endif %}
{% if dec %}<p><strong>{{ dec.decision|capitalize }}</strong> by {{ dec.by }} at {{ dec.at }}
  {% if dec.record_id %}— mock record {{ dec.record_id }}{% endif %}</p>
  {% if dec.notice %}<h2>Drafted notice</h2><pre>{{ dec.notice }}</pre>{% endif %}{% endif %}
<div class="grid">
<section aria-label="Invoice pages">
{% for p in d.pages %}
<div class="page">
  <img src="{{ url_for('page_png', doc_id=d.doc_id, pno=p) }}" alt="Page {{ p }} of {{ d.filename }}">
  {% if ex %}{% for name, f in ex.fields.items() if f.bbox and f.page == p %}
  <div class="src" id="src-{{ name }}" style="left:{{ f.bbox[0]*zoom - 3 }}px; top:{{ f.bbox[1]*zoom - 3 }}px;
       width:{{ (f.bbox[2]-f.bbox[0])*zoom + 6 }}px; height:{{ (f.bbox[3]-f.bbox[1])*zoom + 6 }}px;"></div>
  {% endfor %}{% endif %}
</div>
{% endfor %}
</section>
<section aria-label="Extracted data">
{% if ex %}
<h2>Fields</h2>
<table>
<thead><tr><th>Field</th><th>Value</th><th>Confidence and why</th></tr></thead>
<tbody>
{% for name in editable %}{% set f = ex.fields.get(name) %}
<tr>
  <td>{% if f and f.bbox %}<a href="#src-{{ name }}">{{ name }}</a>{% else %}{{ name }}{% endif %}</td>
  <td>{% if not dec %}<form method="post" action="{{ url_for('do_correct', doc_id=d.doc_id) }}">
      <input type="hidden" name="field" value="{{ name }}">
      <label class="muted" for="v-{{ name }}">Value</label>
      <input type="text" id="v-{{ name }}" name="value" value="{{ f.value if f and f.value else '' }}">
      <button type="submit">Save correction</button></form>
      {% else %}{{ f.value if f else '' }}{% endif %}</td>
  <td>{% if f and f.value %}<span class="{{ 'low' if f.confidence < 0.8 else '' }}">{{ '%.0f%%'|format(f.confidence*100) }}</span><br>
      <span class="muted">{% for k, v in f.factors.items() %}{{ k }} {{ '%.2f'|format(v) }}{{ ', ' if not loop.last }}{% endfor %}</span>
      {% else %}<span class="low">not found</span>{% endif %}</td>
</tr>
{% endfor %}
</tbody></table>
<h2>Line items ({{ ex.line_items|length }})</h2>
<table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>
{% for li in ex.line_items %}<tr><td>{{ li.description }}</td><td>{{ li.quantity }}</td><td>{{ li.unit_price }}</td><td>{{ li.amount }}</td></tr>{% endfor %}
</tbody></table>
{% endif %}
{% if a %}
<h2>Checks</h2>
<ul>{% for c in a.checks %}<li>{{ '✔' if c.passed else '✖' }} <strong>{{ c.code }}</strong>: {{ c.message }}</li>{% endfor %}</ul>
{% endif %}
{% if not dec and d.kind != 'other' %}
<h2>Decision</h2>
<form method="post" action="{{ url_for('do_approve', doc_id=d.doc_id) }}">
  <button type="submit">Approve and create the mock FileOnQ record</button></form>
<form method="post" action="{{ url_for('do_reject', doc_id=d.doc_id) }}">
  <label for="reason">Reject with reason</label>
  <select id="reason" name="reason">{% for code, text in reasons.items() %}<option value="{{ code }}">{{ text }}</option>{% endfor %}</select>
  <label for="note">Note</label><input type="text" id="note" name="note">
  <button type="submit">Reject and draft notice</button></form>
{% endif %}
<h2>Audit trail</h2>
<p class="muted">Append-only: entries cannot be changed or removed from this screen or the database.</p>
<table><thead><tr><th>#</th><th>Time (UTC)</th><th>Who</th><th>What</th></tr></thead><tbody>
{% for e in events %}<tr><td>{{ e.seq }}</td><td>{{ e.ts }}</td><td>{{ e.actor }}</td><td>{{ e.kind }}
  <span class="muted">{{ e.payload }}</span></td></tr>{% endfor %}
</tbody></table>
</section>
</div>
{% endblock %}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `python -m pytest tests/test_app.py -q`
Expected: all pass.

- [ ] **Step 6: Look at it**

```bash
python -m intake.cli run --inbox data/dev/inbox --db out/intake.db --as-of 2026-10-09
flask --app "app:create_app('out/intake.db','out/records')" run --port 5180
```
Open the queue and three documents (one per status) at 1920×1080 and at a narrow window. Check: the banner is visible, clicking a field name highlights its source on the page image, low confidence and failed checks are readable without hovering, approve and reject work, and the audit trail grows.

- [ ] **Step 7: Update `README.md` (how to start the app) and `EFFORT.md` (increment b times)**

- [ ] **Step 8: Run the full suite, commit and push**

```bash
python -m pytest -q
git add poc/intake
git commit -m "Add the technician review screen to the intake proof of concept"
git push origin claude/demo-review-poc-scope-okucbe
```

---

### Task 11: Findings for the deal package (internal)

**Files:**
- Create: `docs/reviews/2026-10-09-intake-poc-findings.md`

- [ ] **Step 1: Write the findings note** with these sections, quoting numbers from `poc/intake/reports/*.md` with the banner sentence:
  1. What was built and what is real versus mocked.
  2. Results: dev versus held-out field accuracy, the false-ready rate, improper-invoice detection, calibration, and what failed on held-out layouts (by label or layout, in plain words).
  3. What this changes in the package, as recommendations for the user to accept or reject (no client file edited here):
     - D4 test set exists; D5 shape proven; D7 report format exists; B6 metrics are computable.
     - CONOPS §5.4 can describe the review screen as built.
     - Phase 1 estimate: actual effort from `EFFORT.md` against 720 base hours, with the caveats in design §11.
     - Risks confirmed or reduced (vendor variety, false-ready) and the ones still open (scans, FileOnQ interface, platform authorization).
  4. Open questions this surfaced for Phase 0.
  5. Correction rate per field: say that corrections are captured as `field_corrected` events with old and new values, and that the rate itself is measured in Phase 2 with ICE technicians.
- [ ] **Step 2: Re-read every changed file as a skeptical ICE reviewer would.** Search for the banned phrases across `poc/` and `docs/reviews/2026-10-09-*`:
```bash
grep -rniE "learns as it goes|self-learning|reinforcement learning|immutable|very easily|\bfree\b|vetted by dod" poc docs/reviews/2026-10-09-*
```
Expected: no matches (other than this plan's own rule list).
- [ ] **Step 3: Commit and push**

```bash
git add docs/reviews/2026-10-09-intake-poc-findings.md
git commit -m "Summarise what the intake proof of concept means for the plan, CONOPS and estimate"
git push origin claude/demo-review-poc-scope-okucbe
```
