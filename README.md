# Lab Report Translator

**AI explains. Code decides.**

My Telugu-speaking parents cannot read their own lab reports. This web app turns a lab PDF, or a photo of one, into a plain-language table the whole family can read in their own language, with a printable one-page sheet to take to the doctor.

> **Information only, never a diagnosis.** The app repeats what the report prints, says whether a value is inside or outside the *printed* range, and lists questions to ask a doctor. It does not diagnose, recommend treatment, assess risk or give medical advice. The doctor is the advisor; this app is the translator.

Next.js 14 · TypeScript · plain CSS · powered by Meta's **Muse Spark**. No database, no accounts, nothing stored. Synthetic samples only; no real patient data is in this repo.

## What it does

| | |
|---|---|
| **Exact values** | Test names, values, units and printed ranges are copied from the report, never invented. |
| **Flags by plain code** | High / Low / Normal comes from comparing the value to the printed range (`lib/flags.ts`). No printed range: **Unknown**. Conflicting ranges: **Needs review**. |
| **Plain language** | One sentence per test, a 3-line summary and 3 questions for the doctor, in 9 languages (English, Telugu, Hindi, Spanish, Tamil, Kannada, Malayalam, Bengali, Marathi). |
| **Source citations** | Each row has a Source button that opens your PDF or photo with the line highlighted. If no single line matches, there is no button: a missing highlight, never a wrong one. |
| **Ask by voice** | Ask one spoken question about your report and hear the answer. Four guided intents only (see below). |
| **Doctor sheet** | Printable, side by side: your language next to the English clinical values, with room for the doctor's answers. |
| **Family tools** | Large-print handout, WhatsApp share (you pick the recipient; the app sends nothing), Listen (read aloud, line by line), large text and a real high-contrast mode. |

Source citations work like this. For PDFs the highlight comes from the PDF's own text positions (pdf.js), so it is exact. For photos, local OCR (PaddleOCR on ONNX, inside this server) finds every printed line and plain code matches each result to the one line holding its test name and value. It handles patient-portal cards and tilted phone photos (it measures the page angle and judges rows on the straightened page). Measured: 47/47 rows on 10 real Quest portal screenshots, every highlight correct; on 54 simulated phone photos (`npm run evaluate:phone`), 53 cited and 0 wrong. Simulated photos are a proxy; real camera photos are still to be confirmed.

## How Muse Spark is used

Muse Spark runs through the Meta Model API (OpenAI-compatible, model `muse-spark-1.3`) in `lib/muse.ts`. It has six jobs, all about *language*, none about decisions. Muse is the only model the app calls.

| Job | What Muse does |
|---|---|
| Photo reading | Vision: reads a cleaned photo into rows |
| Translation | Translates the summary, questions and explanations into 9 languages |
| Explanations | Rewrites each row's sentence naturally |
| Summary | Writes the 3-line summary |
| Doctor questions | Writes one question per flagged row |
| Second-pass check | Independently confirms each row against its own redacted result line. It can only **downgrade** confidence. |

### Code decides, AI explains

Muse never decides a flag, value, unit or range. Every sentence it writes passes `lib/safety.ts`, and anything that fails is **discarded** and replaced by a code-written sentence:

- An explanation must name the right test and value, contain **no number except the row's own value and printed range**, and state a direction that **agrees with the code-computed flag**. "Lower than the range" for a High row is rejected.
- No diagnoses, conditions, treatment, diet, supplements, risk, speculation, urgency, or "you may have". The filters are tested against an adversarial list.
- The summary must name every High and Low test and add no other number. Doctor questions must name the test and value, end in `?`, and name no condition or treatment.
- Translations are checked item by item: the numbers must match the source and English advice words cannot be smuggled in. A bad item stays in English.
- Uploaded text only reaches Muse inside a `<data>` block with an instruction-ignoring system prompt. The second-pass check can only lower confidence, so a hostile PDF can at worst suppress a warning, never invent a value or a flag.
- Photo rows are always **low confidence** with a "check against your original" note.

## Ask by voice

On the results page, **Ask by voice** takes one spoken question and answers out loud and in text. It understands exactly four things:

1. **Explain a result**: "What does my hemoglobin mean?" One sentence with the test, value, unit, printed range and the code-computed direction.
2. **Read the summary**: the existing 3 lines, unchanged.
3. **Explain a doctor question**: "What does the second doctor question mean?" It rephrases the question in simpler words and never answers it.
4. **Navigate**: "Take me to the doctor sheet", "Switch to Telugu".

**Everything else gets one fixed reply and no answer**, including anything about what to do, seriousness, diet, supplements, medication, diagnosis or "am I okay": *"I can only explain what's printed on your report. For anything about what to do, please ask your doctor — I can help you write the question down."*

Code (`lib/voice.ts`) picks the intent before any model is called. Only the two explain intents call Muse, with a prompt that forbids advice, and every answer must pass `lib/safety.ts` before it is spoken, or it is replaced by the fixed reply. The question reaches Muse only inside a `<question>` block with identifiers removed, plus the structured result rows, and it is listed under "What the AI sees". Speech is the browser's own (`SpeechRecognition` in, `speechSynthesis` out). This app never records or stores audio, but some browsers, such as Chrome, send speech to the browser maker for the speech-to-text step. English, Telugu, Hindi and Spanish are supported. With no microphone, no speech recognition or no API key, the button disables itself with a plain message and nothing else is affected.

## Privacy

The app stores nothing: no database, no accounts, files are handled in memory. **No patient name, date of birth, ID, phone, email or address is sent to the AI**, enforced in three layers so that one failing does not leak.

1. **Only structured rows reach the AI (`lib/privacy.ts`).** Every Muse function takes `MuseSafeRow[]` (test name, value, unit, printed range, flag) and nothing else. The type is branded, so a raw row, a report string or a file name does not compile at any Muse call site, and `lib/privacy.typecheck.ts` fails the build if that stops being true. The report text itself is never sent.
2. **A redaction backstop (`lib/redact.ts`).** The only free text sent is each result's own line, for the second-pass check. A pure, tested redactor:
   - normalises Unicode tricks (full-width letters, zero-width characters, letter-spaced words) so a label cannot hide;
   - **drops the line** if it carries a labelled identifier in English, Spanish, Hindi, Marathi, Telugu, Tamil, Kannada, Malayalam or Bengali (name, DOB, MRN and other IDs, phone, email, address, relatives, insurance, doctor) or a titled name ("Mr. Rao");
   - **masks** emails, URLs, IPs, dates, phone numbers, long digit runs and ID-style tokens inside lines that stay, and turns ages over 89 into "90+";
   - **fails closed on unexplained words**: a result line may hold only the test name, its unit and ordinary result vocabulary. Any other word, such as a name printed after a result with no label, withholds the line, and the page says how many were withheld;
   - runs in linear time (a 200,000-character hostile line takes about 10 ms).
3. **Photos are cleaned before they can be sent (`lib/photo.ts`)**, and the cleaning is checked:
   1. The server redraws the photo upright at a bounded size (this also drops EXIF and GPS data).
   2. Local OCR reads every text box. Nothing leaves the server.
   3. The same identifier patterns flag boxes. A label with nothing after it ("Patient Name", "MRN:") also flags the line below.
   4. Every flagged box is **painted solid black on the pixels**; the original pixels are restored inside unflagged boxes so result rows survive.
   5. The painted picture is **read again**. If any flagged text is still readable it is painted again, and if that does not settle in three rounds the photo is **refused**.
   6. Only the painted picture can be sent: the vision call accepts only a `RedactedPhoto`, which only `lib/photo.ts` can create.

   The upload screen also offers a crop step, and it matters (see below). The photo is refused, not sent, if OCR cannot run or reads too little text to be sure.

The results page has a **What the AI sees** panel with the exact rows and result lines given to the AI for that report, the preview of the cleaned photo, and the count of identifiers kept away. Age and sex are deliberately kept, because reference ranges depend on them; they are not sent today.

**Not covered, honestly:**

- **A name with no label is not found.** A photo that prints `Maria Gonzalez Lopez` with no label is accepted, and that name stays on the picture sent to Muse. The test fixtures show this limit. That is why the upload screen asks you to **crop the header out** (what you trim never leaves your device) and why the results page shows what was sent. PDFs are not affected, since they send structured rows only.
- Anything OCR cannot read is not painted: handwriting, signatures, logos, faces, and barcodes or QR codes. Crop them out or upload a PDF.
- OCR is English-first. A name in another script is covered only on a label line the patterns know.
- This is an assistive filter, not a guarantee. A purely numeric ID with no label and under 7 digits looks like a result and is left alone. Label lists for non-English scripts have not been reviewed by native speakers.
- PaddleOCR runs locally as a tool, like a PDF parser, to find where text is. It decides nothing about the report.
- See Meta's terms for what they retain.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Create `.env.local` (never commit it), or copy `.env.example`:

```
META_MODEL_API_KEY=<META_API_KEY>   # replace with your Muse key
META_MODEL_API_URL=https://api.meta.ai/v1/chat/completions
META_MODEL=muse-spark-1.3
```

The first screen has two actions: **Choose your report** and **Try an example report**. Without a key, the PDF flow still works with the code-written sentences; photos, translation and voice need Muse.

| Variable | Purpose |
|---|---|
| `META_MODEL_API_KEY` (alias `MODEL_API_KEY`) | Your Muse key |
| `META_MODEL_API_URL`, `META_MODEL` | Optional overrides |
| `MUSE_TIMEOUT_MS` | Per-call timeout, default 45000 (vision 55000) |
| `MUSE_MAX_TOKENS` | Token budget per call, default 8000. Muse Spark is a reasoning model and its hidden thinking counts against this; at 3000 a live run returned empty answers |
| `MUSE_REASONING_EFFORT` | Default `low`; `off` stops sending it. If the gateway rejects it with HTTP 400 the app retries without it |
| `OCR_TIMEOUT_MS` | Time limit for the local photo reader, default 30000 |

## Tests

```bash
npm test          # also runs before every `npm run build`, so a regression fails the deploy
npm run typecheck
```

`scripts/evaluate.mjs` runs the **real** `lib/` modules, the **real sample PDF** through the real reader, real OCR on fixture photos, and a mocked Meta API. No key or network is needed. It runs over 400 checks in these groups:

| Group | What it proves |
|---|---|
| Flag engine, parser, verifier | Boundaries, missing and half-open ranges, 60+ realistic report lines (qualified results like `<0.5` are refused, not misread), tampered values are caught |
| Real PDF end to end | `public/sample-report.pdf` gives the 8 correct rows; patient name and DOB never become rows |
| AI-output safety | Faithful sentences accepted; diagnoses, advice, invented numbers, contradictions of the code's flag and urgency rejected |
| Privacy | 30+ adversarial identifier lines go through the redactor and the whole pipeline with a mocked API; every request body is inspected for leaks; the build fails if raw text becomes acceptable to a Muse function |
| Photo cleaning | Each fixture is cleaned, read again, and no labelled identifier can be made out while every result row survives; blank and non-image uploads are refused; the image inside the real Muse request body is decoded and read; only `lib/muse.ts` calls a model API |
| Photo citations | OCR finds the line and code matches it, including cards and tilted photos |
| Voice Q&A | Intents classify in en/te/hi/es; the 5 required adversarial questions plus 38 more return the redirect line word for word and never reach Muse; every unsafe model answer becomes the redirect line; spoken questions are redacted first |
| Localized interface, sharing | Every interface string exists and is translated in all eight non-English languages; share text adds no numbers and keeps the information-only line |
| Muse pipeline (mocked) | Good output used, adversarial output dropped, HTTP errors handled, flags and values never change, hostile text stays inside `<data>` |

**Not tested:** the live Meta API. The Muse code follows the documented OpenAI-compatible request shape and is exercised against a mock; its real output quality (especially vision and Telugu translation) is checked by running the app with a key, not by the automated tests.

## Architecture

```
Browser (app/page.tsx)
  ├─ POST /api/analyze     PDF   → lib/pdftext → lib/parse → lib/flags → lib/verify
  │                        photo → lib/photo (local OCR, paint out identifiers, read again) → Muse vision → lib/flags
  │                        then lib/enhance runs the Muse jobs in parallel, each checked by lib/safety
  ├─ POST /api/translate   Muse translation, validated per item
  └─ POST /api/voice-ask   code picks 1 of 4 intents → Muse words for 2 of them → lib/safety → answer or fixed redirect
```

Uploads are checked by file signature, capped at 10 MB and rate-limited per IP (in memory; use a platform limiter in production).

## Known limitations

- Reads **digital PDFs**. A scanned PDF should be uploaded as a photo.
- The parser handles common one-row-per-line layouts. Lines it cannot read are listed in the UI, not silently dropped.
- `>40` is treated like `≥40`, so a value exactly equal to the bound is Normal.
- The interface text in all eight non-English languages, and the voice keywords for Telugu, Hindi and Spanish, were written for this project and need native-speaker review.
- Listen and voice need a browser voice for the language; the app warns when there is none. Tested with a stubbed voice, not yet with a real Telugu voice.
- Not a medical device. Not validated clinically.

**Not built, on purpose:** accounts, report history or storage, diagnosis, treatment advice, risk scores, an open medical chatbot, EHR integration, or any real patient data.

## Deploy

Deploy as a Next.js app (Vercel or any Node host). Photos load the PaddleOCR engine (about 60 MB for the Linux runtime and models); `next.config.js` tells the file tracer to ship it and to leave out the Windows and macOS runtimes. The build needs no network beyond npm and downloads no models. Photos are refused, not sent uncleaned, when OCR cannot run, so after deploying, upload one photo on the live link. Set `META_MODEL_API_KEY` in the host's dashboard, never in the repo.

## License

MIT. See `LICENSE`.
