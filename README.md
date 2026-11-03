# Lab Report Translator

**AI explains. Code decides.**

My Telugu-speaking parents cannot read their own lab reports. This web app turns a lab PDF (or a photo of one) into a plain-language table the whole family can read, in their language, plus a printable one-page sheet to take to the doctor.

> **Information only, never a diagnosis.** This is a readability and health-literacy tool. It does not diagnose, recommend treatment, assess risk or give medical advice. It repeats what the report prints, says whether a value is inside or outside the *printed* range, and lists questions to ask a doctor. The doctor is the advisor; this app is the translator.

Built with Next.js 14, TypeScript and plain CSS. No database, no accounts, nothing stored. MIT licensed.

## What it does

- **Exact values, units and printed ranges**, copied from the report. Never invented.
- **Source citations**: use the Source column to open your uploaded PDF or photo in a side drawer with the source line highlighted. For PDFs the highlight comes from the PDF's own text positions (pdf.js), so it is exact. For photos, local OCR (PaddleOCR on ONNX, run inside this server; the photo goes nowhere else) finds every printed line and plain code matches each result to the one line holding its test name and value. If no single line matches, that row simply has no button: a missing highlight, never a wrong one. The browser first redraws the photo upright, on white, at a readable size, so what you see, what OCR reads and what Muse reads are the same picture. The matcher understands patient-portal cards (name left, result box right, range line below) and tilted photos (it measures the page angle from the OCR text boxes and judges rows on the straightened page). Measured: 47/47 rows on 10 real Quest portal screenshots, 100% of highlights correct; on 54 simulated phone photos (tilt, keystone, shadow, glare, blur, noise, heavy JPEG; `npm run evaluate:phone`) 53 cited, 0 wrong. Simulated is a proxy; real camera photos are still to be confirmed.
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
| Second-pass check | Independently confirms each extracted row against its own redacted result line. Can only **downgrade** confidence. |

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

The app stores nothing: no database, no accounts, files are handled in memory. **No patient name, date of birth, ID, phone, email or address is sent to the AI.** That is enforced in three layers, so that one failing does not leak:

1. **The AI only ever receives structured rows (`lib/privacy.ts`).** Every Muse function takes `MuseSafeRow[]` (test name, value, unit, printed range, flag) and nothing else. The type is branded, so a raw `LabRow`, a report string or a file name does not compile at any Muse call site, and `lib/privacy.typecheck.ts` makes the build fail if that ever stops being true. The report text itself is never sent. Even if redaction missed a name in the header, the header cannot reach the model because no Muse function accepts it.
2. **Redaction backstop (`lib/redact.ts`).** The only free text sent is each result's own line, for the second-pass check. A pure, tested redactor handles it, in this order:
   - *Normalise*: Unicode compatibility forms (full-width letters), zero-width characters, odd dashes, and letter-spaced words ("P a t i e n t") cannot hide a label.
   - *Drop the line* if it carries a labelled identifier in English, Spanish, Hindi, Marathi, Telugu, Tamil, Kannada, Malayalam or Bengali (name, DOB, MRN/UHID/account/lab/visit numbers, phone, email, address, relatives, insurance, doctor, ...) or a titled name ("Mr. Rao"). Boundaries are Unicode-aware, because `\b` does not work for Indian scripts. The parser uses the same check, so "MRN 00481516" is never read as a lab result.
   - *Mask patterns* inside lines that stay: emails (including "name [at] host"), URLs, IP addresses, dates in many formats, phone numbers (found with a sliding window, so a phone next to a reference range is still caught), long digit runs, and ID-style tokens such as `AC-99120045` or `ABCDE1234F`. Ages over 89 become "90+" (HIPAA Safe Harbor).
   - *Fail closed on unexplained words*: a result line may only hold the test name, its unit and ordinary result vocabulary ("High", "Optimal", ...). A line with any other word, such as a name printed after a result with no label, is **withheld** from the second check instead of sent. The page tells the user how many lines were withheld.
   - Placeholders are a neutral `[redacted]`, so a second pass cannot mistake one for a label (the redactor is idempotent, and tested to be).
   - Linear time: a 200,000-character hostile line takes about 10 ms (an earlier email pattern was quadratic; a test now guards it).

   The audit (count and kinds, never the values) is shown in the app as "N identifiers were kept away from the AI".
3. **Photos are cleaned before they can be sent (`lib/photo.ts`).** A photo cannot become rows without sending a picture to Muse's vision model, so the picture is cleaned first, and the cleaning is checked:
   1. The server redraws the photo upright, on white, at a bounded size (this also drops EXIF and GPS data).
   2. A local OCR engine (PaddleOCR on ONNX, inside this server) reads every text box on it. Nothing leaves the server.
   3. Each box is flagged by the **patterns** (layer 2) or by a **clinical de-identification model** (below). A label with nothing after it ("Patient Name", "MRN:") also takes the line under it, where its value sits.
   4. Every flagged box is **painted solid black on the pixels**. The paint is generous (it covers ascenders, descenders and tilted or merged lines), and the original pixels are put back inside the boxes of text that was not flagged, so a result row next to a name line survives.
   5. The painted picture is **read again**. If any flagged text can still be read, or new identifiers appear where none were judged clean, it is painted again; if that does not settle in three rounds the photo is **refused**.
   6. Only that painted picture can be sent: the vision call is typed to accept a `RedactedPhoto`, which only `lib/photo.ts` can create, and `lib/privacy.typecheck.ts` fails the build if a raw upload ever type-checks there.

   The photo is also **refused, not sent**, when the local reader cannot run, when too little text could be read to be sure (fewer than 3 text boxes), or when the privacy model is not installed (unless you set `NER_REQUIRED=0`, which allows patterns-only cleaning and says so in the panel). The browser still offers an optional crop step as an extra layer: whatever is trimmed never leaves the device.

   **The model.** [StanfordAIMI/stanford-deidentifier-base](https://huggingface.co/StanfordAIMI/stanford-deidentifier-base) (MIT), in its ONNX int8 build, trained on radiology and clinical notes for exactly this job (published F1 about 99 on the i2b2 benchmarks). It finds patient and clinician names, hospitals and addresses, ID numbers, phone numbers and dates with **no label needed**, which patterns cannot: `Maria Gonzalez Lopez`, `SMITH, JOHN A`, `Reviewed by Priya Raman MD`, `Apollo Hospitals, Jubilee Hills, Hyderabad`. It runs on the server (about 8 ms per line), nothing is sent anywhere to run it, and it is used **together with** the patterns: either one is enough to flag something. `npm run models` downloads it once and checks each file against a pinned SHA-256 (it runs before `npm run dev` and `npm run build`). Guards that were needed after measuring it on real reports: a short bare number in a result box is a value, not an ID; a reference range such as `70-99` is never taken for a date; and a result row whose spaces OCR dropped (`Sodium138mmol/L135-145`) is not mistaken for an ID.

   For PDFs the same model also screens each result line before the second-pass check, and adds what it found in the full text to the count shown to the user. Model installed but failing: no line is sent. Model not installed: patterns only, and the panel says so.

**Deliberately kept:** age and sex. Many reference ranges depend on them, and alone they do not identify a person. They are still not sent today (layer 1 sends no free text), and the redactor leaves them alone if they appear in a result line.

**What the AI sees.** The results page has an expandable "What the AI sees" panel with the exact rows (and result lines) given to the AI for that report. Translation sends the app's own plain-English sentences back to the AI; those contain only test names, values and ranges.

**Measured** (all synthetic or screenshot data, reproducible with `npm test`): the model finds 12/12 unlabelled names, places, IDs and dates in a hard corpus, and flags 0 of the ordinary result lines in the corpus (and 0 of 47 result lines from real Quest screenshots); 6 fixture photos (labelled header, unlabelled names, stacked label-over-value in capitals, and tilted, blurred, glare-lit copies) are cleaned with **0 invented identifiers readable afterwards and 0 result rows lost**; on 10 real Quest screenshots, 0 of 47 rows are damaged by painting; and an end-to-end test intercepts the real request body, decodes the image out of it and reads it.

**Not covered, honestly:**
- Anything OCR cannot read is not painted: **handwriting, a signature, a logo, a face, and barcodes or QR codes** (which can encode a patient ID). The optional crop step exists for these; for a photo that has them, crop them out or upload a PDF.
- The OCR engine and the model are English-first. A name in another script on a photo is covered only if it sits on a label line the patterns know (those cover nine scripts), not by the model.
- The model's published accuracy is on clinical notes; lab reports are a different style, which is why it is tested here on lab-report-like lines and combined with patterns rather than trusted alone. It is an assistive filter, not a guarantee, and a purely numeric ID with no label and fewer than 7 digits looks like a result and is left alone.
- Labels were written from common usage in each language and have not been reviewed by a native speaker for every script. Institution names are painted when the model flags them but are not treated as patient identifiers.
- See Meta's terms for what they retain.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 (first run downloads the 110 MB privacy model, then caches it)
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
| `NER_REQUIRED` | Default on: a photo is refused when the privacy model is not installed. Set `0` to allow patterns-only cleaning (the panel then says so) |
| `NER_MODEL_DIR`, `NER_TIMEOUT_MS`, `OCR_TIMEOUT_MS` | Optional: model folder (default `models/ner`) and time limits |
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
| Privacy | 30+ adversarial identifier lines (names, DOB in several formats, MRN, phone, email, address, SSN, Aadhaar, insurance, relatives, dates inside result lines) are put through the redactor and through the whole pipeline with a mocked API; every request body is inspected for leaks ("N identifier substrings tested, 0 leaked"); every request carries only allow-listed row fields; rows are byte-identical before and after; the user-facing audit contains no identifiers; the build fails if raw text becomes accepted by a Muse function |
| Privacy model and photo cleaning | The real model and OCR run on six fixture photos (labelled, unlabelled, stacked-capitals, tilted, blurred, glare): each cleaned photo is read again and none of the invented identifiers can be made out, every result row survives; recall on unlabelled names/places/IDs/dates; zero flags on ordinary result lines; long text read in windows with exact offsets; refusals (blank photo, not an image, model missing); patterns-only mode; an end-to-end check on the image actually inside the Muse request body |
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

Deploy as a Next.js app (Vercel or any Node host). Photos load the PaddleOCR engine (about 60 MB for the Linux runtime and models) and the privacy model (110 MB, fetched by `npm run models` during the build, which needs network access to huggingface.co; every file is checked against a pinned SHA-256). Together that is close to a serverless function's size limit on some plans, so check the build output and upload one photo on the live link; a host that cannot fit them should use a Node server instead. **Photos are refused, not sent uncleaned, when the OCR or the model cannot run.** `next.config.js` tells the file tracer to ship those and leave out the Windows and macOS runtimes. Set `META_MODEL_API_KEY` in the dashboard, never in the repo. Check the public link in a logged-out browser. `npm run build` runs the test suite first, so a regression fails the deploy.

## License

MIT. See `LICENSE`.
