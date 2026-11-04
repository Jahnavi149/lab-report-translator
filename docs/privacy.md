# Privacy

[← Back to README](../README.md)

**No patient name, date of birth, ID, phone, email or address is sent to the AI.** Three layers, so one failing does not leak.

## Layer 1: structured rows only

Every Muse function takes `MuseSafeRow[]` (test name, value, unit, printed range, flag), a branded type. A raw row, report string or file name does not compile at a Muse call site, and the build fails if that stops being true ([`lib/privacy.typecheck.ts`](../lib/privacy.typecheck.ts), [`lib/privacy.ts`](../lib/privacy.ts)).

## Layer 2: pattern redactor

[`lib/redact.ts`](../lib/redact.ts). The only free text sent is each result's own line.

- Lines with a labelled identifier are dropped. Labels are covered in English, Spanish, French, German, Portuguese, Indonesian, Malay, Tagalog, Arabic and six Indian languages.
- Identifier-like patterns (phone, email, ID numbers, dates of birth) are masked.
- A line with any unexplained word is withheld.
- Arabic-Indic digits and Arabic diacritics are normalised first, so they cannot hide a label.

## Layer 3: photo cleaning

[`lib/photo.ts`](../lib/photo.ts). Local OCR finds every text box. Identifier boxes are **painted black on the pixels**, then the painted picture is **read again**. If any painted text is still readable, the photo is refused. Only the painted picture can reach Muse.

## See it yourself

The results page has a **What the AI sees** panel showing the exact rows, lines and cleaned photo given to the AI, and how many identifiers were kept away.

## Nothing is stored

Files are processed in memory for the one request and never saved. Voice recordings are held in memory for the one transcription request. **Clear report** drops everything on the page.

## No other models

The only models called at runtime are Meta's Muse models. Where text sits on a photo is found by PaddleOCR running locally on the server as OCR tooling, like a PDF parser. It is a text-recognition network, not a language model, and it decides nothing.
