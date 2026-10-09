# ICE post-demo release set

Send these files to ICE in this order. Each file is ready except where noted.

| Order | File | Status before sending |
|---|---|---|
| 1 | `1-Email-follow-up-and-corrections.txt` | Ready. Paste into email. Send first. Attach the Oct 5 slides once they have been checked for the four corrected claims (the slides are not in this repo) |
| 2 | `2-Email-package-transmittal.txt` | Ready except the signature. Send with files 3 to 5 |
| 3 | `ICE_AP_Intake_Project_Plan_DRAFT.docx` | Ready for internal sign-off |
| 4 | `ICE_AP_Intake_CONOPS_DRAFT.docx` | Ready for internal sign-off |
| 5 | `ICE_AP_Intake_Cost_Estimate_DRAFT.docx` | **Not ready.** Pricing must fill every "[TO BE PRICED]" field and insert the proprietary/pricing legend. Confirm the pricing structure (firm fixed price for Phases 0–2) with contracts |

The Word files are generated from `source/*.md`. Edit the Word files directly for small changes. For larger changes, edit the source and regenerate with pandoc.

The internal versions, with notes on where each number came from, are in `../proposal/`. Do not send those.

## Regenerating the Word files

From the repo root, with pandoc installed:

```bash
mkdir -p /tmp/ice-md
python3 docs/ice-release/build/build.py docs/ice-release/source docs/ice-release docs/ice-release/build/reference.docx /tmp/ice-md
```

The script sets table column widths, keeps table rows from splitting across pages, and applies the styles in `build/reference.docx`.
