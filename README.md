# Lab Report Translator

**Turns a lab report (PDF or photo) into plain language in nine languages, with a one-page sheet for the doctor.**

My parents speak Telugu and couldn't make sense of their own lab reports, so I built this. Upload a PDF or a photo and get every result in plain sentences, flags worked out by code, and a printable sheet to take to the doctor. Meta's Muse Spark extracts grounded result rows and writes the language; plain code validates the evidence and decides every flag. Your lab report, in your family's language.

> **Information only, never a diagnosis.** This app does not diagnose, recommend treatment, assess risk or give medical advice. It repeats what the report prints, says whether a value is inside or outside the *printed* range, and lists questions to ask a doctor.

**[Demo video](TODO)** · **[Live app](https://lab-report-translator-chu4l7oeaa-el.a.run.app/)**

The video opens with a statement of what existed before the event and what was built during it (see [Build disclosure](#build-disclosure)). The live app has a Muse key configured, so everything works there with nothing to set up.

## What it does

- Upload a lab **PDF or photo**; nothing is stored.
- One **plain-language row** per test: exact value, unit and printed range, copied from the report.
- **Flags decided by code**: High, Low or Normal against the printed range; Unknown if none is printed.
- **Source citations**: open your PDF or photo with the source line highlighted. No match means no button, never a wrong highlight.
- **9 languages**: English, Telugu, Hindi, Spanish, Tamil, Kannada, Malayalam, Bengali, Marathi.
- **Ask by voice**: one spoken question, four guided intents, answered aloud and in text.
- **Listen** mode reads the summary and questions aloud, line by line.
- **Printable doctor sheet**: your language beside the English values, a date of test, and room for the doctor's answers.
- **WhatsApp share** and a **large-print handout** for the family; large text and high-contrast modes.

## How Meta's Muse is used

Two Meta models run through the Meta Model API (`lib/muse.ts`). **Muse Spark** (`muse-spark-1.3`) has seven language jobs, and **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) hears the spoken question. Neither decides anything.

| Job | What Muse does |
|---|---|
| PDF reading | Reads locally redacted selectable PDF text into grounded rows |
| Photo reading | Vision: reads a cleaned photo into rows |
| Explanations | Rewrites each row's sentence naturally |
| Summary | Writes the 3-line summary |
| Doctor questions | Writes one question per flagged row |
| Translation | Translates summary, questions and explanations |
| Second-pass check | Re-checks each row against its own redacted line; it can only **lower** confidence |
| Voice answers | Writes the words of one spoken answer (two intents only) |
| Hearing | Muse Voice Transcribe turns one spoken question into text, in English, Telugu, Hindi or Spanish. Code then decides what it means |

## How code decides

**AI extracts and explains; code validates and decides flags.** Muse proposes values, units and ranges from redacted PDF text or a cleaned photo. Code accepts PDF rows only when the returned fields are grounded in an exact source line, and code always calculates the flag.

- `lib/flags.ts` compares each value with the printed range. Several conflicting ranges for one test: **Needs review**, never a guess.
- `lib/safety.ts` checks every sentence Muse writes: the right test and value, no other number, a direction that matches the code's flag, and no diagnosis, treatment, diet, supplement, risk, urgency or "you may have".
- **Fallback chain:** if Muse's output fails a check, or the call fails, it is discarded and the code-written sentence stands in. Translations are checked item by item, and a bad item stays in English.
- Uploaded text only reaches Muse inside a `<data>` block with an instruction-ignoring prompt. Photo rows are always low confidence with a "check against your original" note.

## Voice

**Ask by voice** understands four things: explain a result, read the summary, rephrase a doctor question in simpler words, and navigate ("take me to the doctor sheet"). Code picks the intent before any model is called, and every answer passes `lib/safety.ts` before it is spoken. Anything else, and anything about what to do, gets one fixed reply and no answer:

> "I can only explain what's printed on your report. For anything about what to do, please ask your doctor — I can help you write the question down."

**Hearing is Muse Voice Transcribe.** The page records one short question (up to 15 seconds, stopped by a pause), sends it to `/api/transcribe`, and gets text back. The audio is held in memory for that one request and never saved. The text then goes through the same keyword matcher as any other question, so a mis-heard word can at worst produce the fixed reply above. For English questions, the report's test names are sent along only to help the model spell them. **Speaking** is the browser's `speechSynthesis`. If transcription is unavailable, the browser's own speech recognition takes over (in some browsers, such as Chrome, the browser maker does that step). Voice works in English, Telugu, Hindi and Spanish.

The recording is the user's voice, so it can carry a name if one is spoken aloud. Nothing downstream trusts it: the transcript passes the identifier check before any language model sees it. Please don't say a name.

## Privacy

Labelled patient names, dates of birth, IDs, phone numbers, emails and addresses are removed before content is sent to the AI. The app uses three layers:

1. **Branded model inputs.** PDF extraction accepts only `MuseSafeReportText`, created after local redaction. Later jobs accept only `MuseSafeRow[]` (test name, value, unit, printed range, flag). A raw report string, raw row or original upload does not compile at a Muse call site (`lib/privacy.typecheck.ts`).
2. **Pattern redactor** (`lib/redact.ts`). Before selectable PDF text is sent, lines with a labelled identifier (nine scripts) are dropped and identifier-like patterns are masked. Result lines used for the second check have an additional unexplained-word rule. Pattern matching can miss an unlabelled name, so the results page shows the exact redacted text sent.
3. **Photo cleaning** (`lib/photo.ts`). Local OCR finds every text box, identifier boxes are **painted black on the pixels**, and the painted picture is **read again**. If painted text is still readable, the photo is refused. Only the painted picture can reach Muse.

The results page has a **What the AI sees** panel with the exact redacted PDF text, rows, result lines or cleaned photo given to the AI. Pattern redaction cannot guarantee that an unlabelled name will be recognized.

**No third-party model runs in the app. The only models called at runtime are Meta's Muse models.** Where text sits on a photo is found by PaddleOCR running locally on this server as OCR tooling, like a PDF parser. It is a text-recognition network, not a language model, and it explains and decides nothing.

## Run it

The **[Live app](https://lab-report-translator-chu4l7oeaa-el.a.run.app/)** needs no setup. To run it locally, you add your own key.

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and replace the placeholder with **your own Meta Model API key** (get one at dev.meta.ai). Never commit it:

```
META_MODEL_API_KEY=your-key-here
```

Then start the app:

```bash
npm run dev          # http://localhost:3000
```

Click **Try an example report** to see everything on a synthetic sample. Node 18.17 or newer. `.env.local` is git-ignored; `.env.example` documents every variable.

- PDF and photo reading require a configured Muse key. Code-written explanation, summary and question templates remain the fallback after extraction.
- Slow host? Raise `MUSE_TIMEOUT_MS` (default 45000 ms; vision calls 55000).

## Tests

```bash
npm test      # 472 checks as of this commit; also runs before every `npm run build`
```

`scripts/evaluate.mjs` runs the real `lib/` modules, the real sample PDF, real OCR on fixture photos and a mocked Meta API. No key or network needed. It covers the flag engine, parser, AI-output safety filters, privacy (30+ adversarial identifier lines inspected in every request body), photo cleaning, voice intents and redirects, interface strings in all nine languages, and the Muse pipeline with bad output injected.

**Measured separately, not by `npm test`:** photo citations on 10 real Quest portal screenshots (`scripts/review-citations.mjs`) found 47 of 47 rows with every highlight correct. On 54 simulated phone photos (`scripts/simulate-phone.mjs`), 53 were cited and none wrongly. The screenshots are health data and are not in the repo, so a fresh clone cannot reproduce these. Simulated photos are a proxy; real camera photos are unmeasured.

**Not tested:** the live Meta API. Its real output quality, especially vision and Telugu, was checked by hand, not by an automated test.

## Architecture

Next.js 14 and TypeScript (strict). No database, no accounts, nothing stored: files are processed in memory on the server, and the page drops the report when you click **Clear report**. Digital PDFs go through pdf.js, local text redaction, Muse extraction, evidence grounding and the flag engine; photos go through local OCR and painting, then Muse vision. Muse language jobs run in parallel and each passes `lib/safety.ts`. Deploy on any Node host: the photo reader needs about 60 MB for the OCR runtime and models, and photos are refused, not sent uncleaned, if it cannot run.

## Limitations

- **A name printed with no label on a photo is not found.** Crop the header out: that is the real protection, and the upload screen offers a crop step. PDFs are unaffected.
- Handwriting, signatures, logos, faces and **QR codes** are not painted out. Crop them or upload a PDF.
- OCR is English-first; the identifier patterns cover nine scripts, but have not been reviewed by native speakers.
- **Translations and interface text need native-speaker review.** Test names, units and numbers stay in English so they match the paper report.
- Voice tested end to end in a browser (microphone → WAV → Muse Voice Transcribe → answer) with synthetic English and Telugu speech, not with real people. Telugu transcription was exact on the sample question in most runs and off by one word in others. Listen mode with a real Telugu voice: **not yet**.
- Reads digital PDFs; a scanned PDF should be uploaded as a photo. Unusual layouts can be skipped, and skipped lines are listed.
- Not a medical device and not clinically validated.

## Build disclosure

All code in this repository was written during the hackathon build window (Oct 26 – Nov 4, 2026). **Nothing in it is pre-existing.** Third-party packages (Next.js, pdf.js, PaddleOCR on ONNX, sharp) are used as dependencies.

MIT licensed. See `LICENSE`.
