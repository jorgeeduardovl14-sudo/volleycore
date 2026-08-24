# VolleyCore UI 2.14.19 — PDF Calendar Import

## Added
- Category calendar importer now accepts PDF in addition to XLS/XLSX/CSV.
- PDF.js extracts text directly in the browser; no PDF is uploaded to an external parsing service.
- Administrator supplies the team name to locate in the PDF (default: SANTA BARBARA).
- Parser is designed for structured federation-style tables with columns similar to:
  Día / Fecha / Hora / Sede / Grupo / Equipo Casa / Equipo Visita.
- Only rows involving the requested team are presented.
- Home/Away, opponent, date, start time and venue are inferred from the table.
- Preview remains mandatory before Firebase writes.
- Existing duplicate detection remains active.
- Unregistered venues no longer invalidate a PDF row; the venue name is preserved as `sourceVenueName`.
- Event display falls back to `sourceVenueName` when there is no registered venue ID.

## Important
- PDF source may not contain an end time. VolleyCore does NOT invent one.
- Image-only/scanned PDFs are not OCR'd in this version.
- This release targets text-based structured PDFs like the supplied FECOVOL U19 schedule.

## No changes
- Firestore rules
- ONVO/payment logic
- Storage/App Check
- Super Admin governance

## Commit
UI 2.14.19 - add assisted PDF calendar import by category
