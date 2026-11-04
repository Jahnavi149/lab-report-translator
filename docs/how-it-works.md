# How it works

[← Back to README](../README.md)

**AI explains, code decides.** Muse writes words. Code owns every number, flag and range.

## The flow

```
PDF ──► pdf.js text ──► parser ──► verifier ──► flag engine ──► Muse (words only) ──► safety check ──► page
Photo ─► local OCR ─► paint out identifiers ─► read again ─► Muse vision ─► flag engine ─► ... (same)
```

| Step | File | What it does |
|---|---|---|
| Read | [`lib/pdftext.ts`](../lib/pdftext.ts), [`lib/photo.ts`](../lib/photo.ts), [`lib/ocr.ts`](../lib/ocr.ts) | Text from a PDF; or a cleaned photo plus local OCR for line positions |
| Parse | [`lib/parse.ts`](../lib/parse.ts) | Test name, value, unit, printed range. Decides dot or comma number style per report |
| Verify | [`lib/verify.ts`](../lib/verify.ts) | Each extracted number must be found on its own source line, or the row is marked low confidence |
| Flag | [`lib/flags.ts`](../lib/flags.ts) | High, Low or Normal against the printed range; Unknown if none is printed |
| Write | [`lib/muse.ts`](../lib/muse.ts), [`lib/enhance.ts`](../lib/enhance.ts) | Muse writes explanations, summary and doctor questions |
| Check | [`lib/safety.ts`](../lib/safety.ts) | Every Muse sentence must pass before it is shown |

## Flags are decided by code

`lib/flags.ts` compares the value with the printed range. If a test prints several conflicting ranges, the row is **Needs review**. Nothing is guessed.

## Every Muse sentence is checked

`lib/safety.ts` accepts a sentence only if it has:

- the right test name and value, and no other number;
- a direction that matches the code's flag;
- no diagnosis, treatment, diet, supplement, risk, urgency or "you may have".

## Fallback chain

If Muse's output fails a check, or the call fails or times out, the output is discarded and the **code-written sentence** is shown instead. Translations are checked item by item, and an item that fails stays in English. The app always has a safe answer.

## Prompt-injection guard

Uploaded text only reaches Muse inside a `<data>` block with an instruction-ignoring system prompt. Muse's answers pass the same safety check whatever the report says.

## Photos

Photo rows are always marked low confidence with a "check against your original" note. Citations use local OCR: a highlight is shown only when the match is certain, otherwise there is no button.

## Stack

Next.js 14, TypeScript (strict). No database, no accounts. Files are processed in memory.
