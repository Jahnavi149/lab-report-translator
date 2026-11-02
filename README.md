# Lab Report Translator

**AI explains. Code decides.**

My Telugu-speaking parents cannot read their own lab reports. This web app turns a lab PDF (or a photo of one) into a plain-language table the whole family can read, in their language, plus a printable one-page sheet to take to the doctor.

> **Information only, never a diagnosis.** This is a readability and health-literacy tool. It does not diagnose, recommend treatment, assess risk or give medical advice. It repeats what the report prints, says whether a value is inside or outside the *printed* range, and lists questions to ask a doctor. The doctor is the advisor; this app is the translator.

Built with Next.js 14, TypeScript and plain CSS. No database, no accounts, nothing stored. MIT licensed.

## What it does

- **Exact values, units and printed ranges**, copied from the report. Never invented.
- **PDF source citations**: use the Source column to open the uploaded PDF in a side drawer and highlight the source line.
- **Flags decided by plain code** (`lib/flags.ts`): High / Low / Normal by comparing the value to the printed range, or **Unknown** when no range is printed. If a report prints several different ranges for one test, the app refuses to pick one and marks the row Needs Review.
- **One plain-English line per test**, a **3-line summary**, and **3 doctor questions** built from flagged or Unknown rows.
- **9 languages.** Summary, explanations and questions are translated by Muse Spark. The interface itself is translated for Telugu, Hindi and Spanish.
- **Printable side-by-side doctor sheet**: the family's language on one side, English clinical values for the doctor on the other, a checklist, and space for the doctor's answers.
- **Usable without reading English.** In Telugu, Hindi or Spanish the landing page, main buttons and safety box are translated. **Listen** reads the summary and questions aloud line by line with the current line highlighted.
- **Share with family**: copy the summary, or open **WhatsApp** with the family-language summary and questions pre-filled (you choose the recipient; nothing is sent by the app).
- **Large-print family handout**: a separate printable page in the family's language with a coloured border on each flagged result.
- **Accessibility**: large text, a real high-contrast mode, Listen (browser speech), keyboard focus styles, reduced-motion support.
- **Per-row "Needs review"** with the reason, shown wherever confidence is low.
- Synthetic samples only. No real patient data is in this repo.

## How Meta's Muse Spark is used

Muse Spark runs through the Meta Model API (OpenAI-compatible, `https://api.meta.ai/v1/chat/completions`, model `muse-spark-1.3`) in `lib/muse.ts`. It has six jobs, all in service of *language*, none of them decisions:

| Job | What Muse does |
|---|---|
| Photo reading | Vision: reads a photographed report into rows |
| Translation | Translates summary, questions and explanations into 9 languages |
| Explanations | Rewrites each row's sentence naturally |
| Summary | Writes the 3-line summary |
| Doctor questions | Writes one question per flagged row |
| Second-pass check | Independently confirms each extracted row against the redacted document text Can only **downgrade** confidence. |

Muse writes the text; the code-written templates in `lib/flags.ts` only stand in for a single sentence that Muse got wrong or that failed validation.

### Code decides, AI explains: how that is enforced

Muse never decides a flag, value, unit or range. Every sentence it writes passes `lib/safety.ts`, and anything that fails is **discarded** and replaced by the code-written sentence:

- An explanation must name the right test and value, contain **no number except the row's own value and printed range**, and state a direction (higher / lower / inside / no range) that **agrees with the code-computed flag**. "Lower than the range" for a High row is rejected.
- No diagnoses, conditions, treatment, diet, supplements, risk, speculation, urgency, or "you may have". The filters are tested against an adversarial list (`npm test`).
- The summary must name every High/Low test and add no other number. Doctor questions must end in `?`, name the test and value, and name no condition or treatment.
- Translations are validated item by item: the numbers must be identical to the source, and English advice words can't be smuggled in. A bad item stays in English.
- Test names from uploads are sanitised, and uploaded text only ever reaches Muse inside a `<data>` block with an instruction-ignoring system prompt. The second-pass check can only lower confidence, so a hostile PDF can at worst suppress a warning, never invent a value or flag.
- Photo rows are always **low confidence** with a "check against your original" warning. Muse's quoted source line is cross-checked against the numbers it returned.

### Privacy

The app stores nothing: no database, no accounts, files are handled in memory. The report text (lines containing patient name, date of birth, IDs, phone, email etc. are removed first; see `redactForMuse`) or your photo is sent to Meta's Muse API to be processed. Photos cannot be redacted. See Meta's terms for what they retain.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

The first screen has two actions: **Choose your report** and **Try an example report**.

Create `.env.local` (never commit it) with your Muse key:

```
META_MODEL_API_KEY=<META_API_KEY>   # replace with your key
META_MODEL_API_URL=https://api.meta.ai/v1/chat/completions
META_MODEL=muse-spark-1.3
```

| Variable | Purpose |
|---|---|
| `META_MODEL_API_KEY` (alias `MODEL_API_KEY`) | Your Muse key |
| `META_MODEL_API_URL`, `META_MODEL` | Optional overrides |
| `MUSE_TIMEOUT_MS` | Per-call timeout, default 45000 (vision 55000) |
| `MUSE_MAX_TOKENS` | Token budget per call, default 8000. Muse Spark is a reasoning model: its hidden thinking counts against this, and at 3000 a live run returned empty answers (`finish_reason=length`) |
| `MUSE_REASONING_EFFORT` | Default `low`. `off` stops sending it. If the gateway rejects it with HTTP 400 the app retries without it |

## Tests

```bash
npm test      # also runs before every `npm run build`
```

`scripts/evaluate.mjs` runs the **real** `lib/` modules (not copies), the **real sample PDF** through the real PDF reader and parser, and a mocked Meta API. No key or network needed. Run it to see the current count. It covers:

| Group | What it proves |
|---|---|
| Flag engine | Boundaries (value equal to a bound is Normal), missing ranges, half-open ranges |
| Parser | 18 realistic line formats: `>`, `≤`, commas, `x10E3/uL`, `Vitamin D, 25-Hydroxy`, H/L markers, multi-tier ranges, qualified results like `<0.5` (refused, not misread), dates and headers skipped, duplicate names |
| Verifier | Per-row, whole-token checks; tampered values and ranges are caught |
| Real PDF end to end | `public/sample-report.pdf` → 8 correct rows, patient name/DOB never become rows, redaction removes identifiers |
| AI-output safety | Faithful sentences accepted; diagnoses, diet/supplement advice, invented numbers, contradictions of the code's flag, urgency and over-long text rejected |
| Localized interface, sharing | Every interface string exists and is translated for te/hi/es; the "does NOT mean" box is translated; share text adds no numbers beyond the summary and questions and keeps the information-only line; the WhatsApp link round-trips the exact text |
| Muse pipeline (mocked API) | Good output used; adversarial output dropped; HTTP 500 and 400 handled; flags/values never change; hostile text stays inside `<data>` |

The latest result is written to `public/eval-results.json`.

**What is not tested:** the live Meta API. The Muse code follows the documented OpenAI-compatible request shape and is exercised against a mock, but its real output quality (especially vision and Telugu translation) has to be checked with a real key. Run the app with your key and try a photo before relying on it.

## Architecture

```
Browser (app/page.tsx)
  ├─ POST /api/analyze     PDF → lib/pdftext → lib/parse → lib/flags → lib/verify
  │                        photo → Muse vision → lib/flags (always low confidence)
  │                        then lib/enhance runs the Muse jobs in parallel, each validated by lib/safety
  └─ POST /api/translate   Muse translation, validated per item
```

Uploads are checked by file signature (not filename), capped at 10 MB, and rate-limited per IP (in-memory; use a platform limiter for real production).

## Known limitations

- Reads **digital PDFs**. Scanned PDFs should be uploaded as a photo (which needs Muse).
- The parser handles common one-row-per-line layouts. Unusual layouts can be skipped; skipped lines are listed in the UI rather than silently dropped.
- `>40` is treated like `≥40`, so a value exactly equal to the bound is Normal.
- The Telugu/Hindi/Spanish interface text was written for this project and should be reviewed by a native speaker. The other five languages show an English interface.
- Listen depends on the browser having a voice for the language; the app warns when it can't find one. Tested with a stubbed voice, not yet with a real Telugu voice.
- Not a medical device. Not validated clinically.

## Not built, on purpose

Accounts, report history or storage, diagnosis, treatment advice, risk scores, a medical chatbot, EHR integration, or any real patient data.

## Deploy

Deploy to Vercel as a Next.js app. Set `META_MODEL_API_KEY` in the dashboard, never in the repo. Check the public link in a logged-out browser. `npm run build` runs the test suite first, so a regression fails the deploy.

## License

MIT. See `LICENSE`.
