# Lab Report Translator

**AI explains. Code decides.**

My Telugu-speaking parents cannot read their own lab reports. This web app turns a lab PDF (or a photo of one) into a plain-language table the whole family can read, in their language, plus a printable one-page sheet to take to the doctor.

> **Information only, never a diagnosis.** This is a readability and health-literacy tool. It does not diagnose, recommend treatment, assess risk or give medical advice. It repeats what the report prints, says whether a value is inside or outside the *printed* range, and lists questions to ask a doctor. The doctor is the advisor; this app is the translator.

Built with Next.js 14, TypeScript and plain CSS. No database, no accounts, nothing stored. MIT licensed.

## What it does

- **Exact values, units and printed ranges**, copied from the report. Never invented.
- **Flags decided by plain code** (`lib/flags.ts`): High / Low / Normal by comparing the value to the printed range, or **Unknown** when no range is printed. If a report prints several different ranges for one test, the app refuses to pick one and marks the row Needs Review.
- **One plain-English line per test**, a **3-line summary**, and **3 doctor questions** built from flagged or Unknown rows.
- **9 languages.** Telugu, Hindi and Spanish are built in and work with **no key and no network**. Tamil, Kannada, Malayalam, Bengali and Marathi need Muse Spark; without it the app says so and shows English.
- **Printable side-by-side doctor sheet**: the family's language on one side, English clinical values for the doctor on the other, a checklist, and space for the doctor's answers.
- **Usable without reading English.** In Telugu, Hindi or Spanish the landing page, main buttons and safety box are translated. A **spoken how-to-use guide** on the landing page reads five steps aloud, highlighting each as it goes. **Listen** then reads the summary and questions line by line with the current line highlighted.
- **Share with family**: copy the summary, or open **WhatsApp** with the family-language summary and questions pre-filled (you choose the recipient; nothing is sent by the app).
- **Large-print family handout**: a separate printable page in the family's language with a coloured border on each flagged result.
- **Accessibility**: large text, a real high-contrast mode, spoken guide and Listen (browser speech), keyboard focus styles, reduced-motion support.
- **Compare two reports**: save one, open another, see value and flag changes (numbers only).
- **Per-row "Needs review"** with the reason, shown wherever confidence is low.
- Synthetic samples only. No real patient data is in this repo.

## How Meta's Muse Spark is used

Muse Spark runs through the Meta Model API (OpenAI-compatible, `https://api.meta.ai/v1/chat/completions`, model `muse-spark-1.3`) in `lib/muse.ts`. It has six jobs, all in service of *language*, none of them decisions:

| Job | What Muse does | Needed Muse? |
|---|---|---|
| Photo reading | Vision: reads a photographed report into rows | **Yes.** There is no keyless equivalent |
| Translation | Translates summary, questions and explanations into 9 languages | **Yes** for 5 languages; Telugu/Hindi/Spanish have built-in packs |
| Explanations | Rewrites each row's sentence naturally | No. A deterministic template exists; Muse makes it read better |
| Summary | Writes the 3-line summary | No (template exists) |
| Doctor questions | Writes one question per flagged row | No (template exists) |
| Second-pass check | Independently confirms each extracted row against the redacted document text | Adds a check; can only **downgrade** confidence |

The honest version: photo reading and five of the nine languages genuinely depend on Muse. The rest is Muse making deterministic text read more naturally, and the app is fully usable without it.

### Code decides, AI explains: how that is enforced

Muse never decides a flag, value, unit or range. Every sentence it writes passes `lib/safety.ts`, and anything that fails is **discarded** in favour of the built-in text:

- An explanation must name the right test and value, contain **no number except the row's own value and printed range**, and state a direction (higher / lower / inside / no range) that **agrees with the code-computed flag**. "Lower than the range" for a High row is rejected.
- No diagnoses, conditions, treatment, diet, supplements, risk, speculation, urgency, or "you may have". The filters are tested against an adversarial list (`npm test`).
- The summary must name every High/Low test and add no other number. Doctor questions must end in `?`, name the test and value, and name no condition or treatment.
- Translations are validated item by item: the numbers must be identical to the source, and English advice words can't be smuggled in. A bad item falls back to the built-in translation.
- Test names from uploads are sanitised, and uploaded text only ever reaches Muse inside a `<data>` block with an instruction-ignoring system prompt. The second-pass check can only lower confidence, so a hostile PDF can at worst suppress a warning, never invent a value or flag.
- Photo rows are always **low confidence** with a "check against your original" warning. Muse's quoted source line is cross-checked against the numbers it returned.

### Privacy

The app stores nothing: no database, no accounts, files are handled in memory. **If a Muse key is configured**, the report text (lines containing patient name, date of birth, IDs, phone, email etc. are removed first; see `redactForMuse`) or your photo is sent to Meta's Muse API to be processed. Photos cannot be redacted. Without a key, nothing leaves the server. See Meta's terms for what they retain.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

The first screen has three big actions: **Listen** (spoken how-to), **Choose your report**, and **Try an example report**, which runs the real PDF reader and parser with **no key**. Everything else (synthetic samples, sample photo, the 15-second tour, the "AI explains, code decides" explainer and the test proof) is under **More options** so it stays out of a first-time user's way.

To enable Muse Spark, create `.env.local` (never commit it):

```
META_MODEL_API_KEY=<META_API_KEY>   # replace with your key; left as the placeholder, the app runs offline
META_MODEL_API_URL=https://api.meta.ai/v1/chat/completions
META_MODEL=muse-spark-1.3
```

| Variable | Purpose |
|---|---|
| `META_MODEL_API_KEY` (alias `MODEL_API_KEY`) | Enables every Muse feature |
| `META_MODEL_API_URL`, `META_MODEL` | Optional overrides |
| `MUSE_TIMEOUT_MS` | Per-call timeout, default 45000 (vision 55000) |
| `MUSE_MAX_TOKENS` | Token budget per call, default 8000. Muse Spark is a reasoning model: its hidden thinking counts against this, and at 3000 a live run returned empty answers (`finish_reason=length`) |
| `MUSE_REASONING_EFFORT` | Default `low`. `off` stops sending it. If the gateway rejects it with HTTP 400 the app retries without it |
| `MUSE_DISABLED=1` | Force the offline path even with a key: **rehearse the no-key demo** |

## Tests

```bash
npm test      # also runs before every `npm run build`
```

`scripts/evaluate.mjs` runs the **real** `lib/` modules (not copies), the **real sample PDF** through the real PDF reader and parser, and a mocked Meta API. No key or network needed. It currently reports **286/286** checks across:

| Group | What it proves |
|---|---|
| Flag engine | Boundaries (value equal to a bound is Normal), missing ranges, half-open ranges |
| Parser | 18 realistic line formats: `>`, `≤`, commas, `x10E3/uL`, `Vitamin D, 25-Hydroxy`, H/L markers, multi-tier ranges, qualified results like `<0.5` (refused, not misread), dates and headers skipped, duplicate names |
| Verifier | Per-row, whole-token checks; tampered values and ranges are caught |
| Real PDF end to end | `public/sample-report.pdf` → 8 correct rows, patient name/DOB never become rows, redaction removes identifiers |
| AI-output safety | Faithful sentences accepted; diagnoses, diet/supplement advice, invented numbers, contradictions of the code's flag, urgency and over-long text rejected |
| Built-in translations | Telugu/Hindi/Spanish: only the report's own numbers appear; names and values copied unchanged |
| Localized interface, sharing, guide | Every interface string exists and is translated for te/hi/es; the "does NOT mean" box and spoken guide are translated; share text adds no numbers beyond the summary and questions and keeps the information-only line; the WhatsApp link round-trips the exact text |
| Muse pipeline (mocked API) | Good output used; adversarial output dropped; HTTP 500 and 400 handled; offline mode makes zero calls; flags/values never change; hostile text stays inside `<data>` |

The latest result is also written to `public/eval-results.json` and shown on the home page.

**What is not tested:** the live Meta API. The Muse code follows the documented OpenAI-compatible request shape and is exercised against a mock, but its real output quality (especially vision and Telugu translation) has to be checked with a real key. Run the app with your key and try the sample photo before relying on it.

## Architecture

```
Browser (app/page.tsx)
  ├─ GET  /api/samples     synthetic reports (lib/samples.ts)
  ├─ POST /api/analyze     PDF → lib/pdftext → lib/parse → lib/flags → lib/verify
  │                        photo → Muse vision → lib/flags (always low confidence)
  │                        then lib/enhance runs the Muse jobs in parallel, each validated by lib/safety
  ├─ POST /api/translate   Muse translation, validated per item (built-in packs in lib/i18n need no call)
  ├─ POST /api/enhance     runs Muse on a built-in SYNTHETIC sample (looked up by id, never client text)
  └─ GET  /api/status      is Muse configured?
```

Uploads are checked by file signature (not filename), capped at 10 MB, and rate-limited per IP (in-memory; use a platform limiter for real production).

## Known limitations

- Reads **digital PDFs**. Scanned PDFs should be uploaded as a photo (which needs Muse).
- The parser handles common one-row-per-line layouts. Unusual layouts can be skipped; skipped lines are listed in the UI rather than silently dropped.
- `>40` is treated like `≥40`, so a value exactly equal to the bound is Normal.
- The built-in Telugu/Hindi/Spanish text was written for this project and should be reviewed by a native speaker.
- The interface is translated only for Telugu/Hindi/Spanish. A few secondary buttons and hints (compare, show original lines, tour, privacy note) are still English, and the other five languages show an English interface.
- Listen and the spoken guide depend on the browser having a voice for the language; the app warns when it can't find one. Tested with a stubbed voice, not yet with a real Telugu voice. The guide is read in English for languages without a built-in pack.
- Not a medical device. Not validated clinically.

## Not built, on purpose

Accounts, report history or storage, diagnosis, treatment advice, risk scores, a medical chatbot, EHR integration, or any real patient data.

## Deploy

Deploy to Vercel as a Next.js app. Set `META_MODEL_API_KEY` in the dashboard, never in the repo. Check the public link in a logged-out browser. `npm run build` runs the test suite first, so a regression fails the deploy.

## License

MIT. See `LICENSE`.
