# Lab Report Translator

**[▶ Demo video](TODO)** · **[🌐 Live app](https://lab-report-translator-chu4l7oeaa-el.a.run.app/)** (Meta key already configured, nothing to set up)

**Upload a lab report (PDF or photo). Get every result in plain words, in your family's language, plus a one-page sheet for the doctor.**

My parents speak Telugu and couldn't make sense of their own lab reports, so I built this. A lab report is a page of numbers in a language many families do not speak at home. This turns that page into something they can understand and bring to the doctor.

> **Information only, never a diagnosis.** The app repeats what the report prints and says whether a value is inside or outside the *printed* range. It never diagnoses, advises treatment or assesses risk.

## What it does

- **PDF or photo in, plain-language rows out.** Exact value, unit and printed range per test, with the flag worked out by code.
- **Source citations.** Open your PDF or photo with the source line highlighted.
- **15 languages:** English, Telugu, Hindi, Spanish, Tamil, Kannada, Bengali, Marathi, Tagalog, Malay, Arabic (right-to-left), French, German, Portuguese, Indonesian. Reports printed with decimal commas (`11,2`, `250.000`) are read correctly. → [Languages](docs/languages.md)
- **Printable doctor sheet** with your language beside the English values and room for the doctor's answers; **large-print handout**; **WhatsApp share**; **Listen** mode; large-text and high-contrast modes.
- **Nothing is stored.** Files are processed in memory and dropped when you press **Clear report**.

## Which Meta model does which job

Only Meta models are called at runtime: **Muse Spark** (`muse-spark-1.3`) writes and translates, **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) hears.

| Job | Model |
|---|---|
| Read a PDF's redacted text into rows | Muse Spark |
| Read a cleaned photo into rows | Muse Spark (vision) |
| Explanations, 3-line summary, doctor questions | Muse Spark |
| Translation into 14 languages | Muse Spark |
| Second-pass check on every row (can only lower confidence) | Muse Spark |
| Words of one spoken answer | Muse Spark |
| Hear one spoken question, in all 15 languages | Muse Voice Transcribe |

Every call, with inputs, outputs and code locations: [Muse usage](docs/muse-usage.md).

## AI explains, code decides

Muse reads the table and writes the words. Code checks the evidence and decides every flag.

| Plain code does | Muse does |
|---|---|
| Accepts a row Muse extracted only if its test name, value, unit and range sit on one exact source line of the report | Reads the redacted PDF text or cleaned photo into rows |
| **Flag engine** ([`lib/flags.ts`](lib/flags.ts)): High, Low or Normal against the printed range; Unknown if none; conflicting ranges become Needs review | Writes the plain-language sentences and translates them |
| **Safety check** ([`lib/safety.ts`](lib/safety.ts)) on every sentence: right test and value, no other number, direction matches the flag, no diagnosis, treatment, diet or risk talk | Hears the spoken question |
| **Fallback chain:** if Muse's output fails a check or the call fails, the code-written sentence is shown instead | |

Details: [How it works](docs/how-it-works.md).

## Privacy: no identifier reaches the AI

1. **Branded inputs.** PDF text reaches Muse only as a type created after redaction; every later job gets just test name, value, unit, range and flag. The build fails if a raw string or an original upload could reach a Muse call.
2. **Pattern redactor.** Lines with a labelled name, birth date, ID, phone or address are dropped and identifier patterns are masked before any PDF text is sent.
3. **Photo cleaning.** Identifiers are painted black on the pixels, then the picture is read again; if any painted text is still readable, the photo is refused.

A **What the AI sees** panel on the results page shows exactly what was sent, including the redacted PDF text. → [Privacy](docs/privacy.md)

## Ask by voice

Press the microphone and ask one short question, in any of the 15 languages. It understands four things: **explain a result**, **read the summary**, **rephrase a doctor question**, and **navigate** ("take me to the doctor sheet", "switch to French"). Code picks the intent before any model is called. Anything about what to do gets one fixed reply: ask your doctor. → [Voice](docs/voice.md)

## Try it

```bash
npm install && cp .env.example .env.local   # put your own Meta Model API key in .env.local
npm run dev                                 # http://localhost:3000
# then click "Try an example report"
```

Or skip setup and use the [live app](https://lab-report-translator-chu4l7oeaa-el.a.run.app/). Node 18.17+. PDF and photo reading use your Meta key; without one the app shows the example report only.

## Tests

`npm test` runs **587 checks** with no key or network: flag engine, parser (including decimal-comma reports in five languages), safety filters, privacy, photo cleaning, voice in all 15 languages, and the Muse pipeline with bad output injected. → [Testing](docs/testing.md)

## Documentation

```
README.md                 you are here
docs/
├── how-it-works.md       architecture, flag engine, safety checks, fallback chain
├── muse-usage.md         every Meta model call and where it lives in the code
├── privacy.md            the three layers that keep identifiers away from the AI
├── voice.md              ask by voice: four intents, hearing, speaking
├── languages.md          the 15 languages, RTL, number styles in reports
├── testing.md            what npm test covers, real-world checks
└── scope.md              what it is not, and what still needs a human reviewer
```

Code map: [`app/`](app) pages and API routes · [`lib/`](lib) parser, flags, safety, privacy, voice, Muse client · [`scripts/`](scripts) tests and sample generators · [`fixtures/`](fixtures) synthetic data.

## Build disclosure

All code in this repository was written during the hackathon build window (Oct 26 – Nov 4, 2026). **Nothing in it is pre-existing.** Third-party packages (Next.js, pdf.js, PaddleOCR on ONNX, sharp) are used as dependencies.

MIT licensed. See [`LICENSE`](LICENSE).
