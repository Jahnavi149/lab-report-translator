# Testing

[← Back to README](../README.md)

```bash
npm test      # 587 checks; also runs before every `npm run build`
```

[`scripts/evaluate.mjs`](../scripts/evaluate.mjs) runs the real `lib/` modules, the real sample PDF, real OCR on fixture photos and a mocked Meta API. No key or network needed.

## What the 583 checks cover

| Area | Examples |
|---|---|
| Flag engine | High, Low, Normal, Unknown; conflicting ranges become Needs review |
| Parser, PDF extraction and verifier | Real PDF end to end; Muse's PDF rows accepted only when grounded in an exact source line; decimal-comma reports in French, German, Portuguese, Indonesian, Spanish, including PDFs with accented characters; malformed numbers refused |
| AI output safety | Diagnosis, advice, wrong numbers and wrong direction are all rejected and replaced |
| Muse pipeline | Mocked API with bad output injected: every failure falls back to code-written text |
| Privacy | 30+ adversarial identifier lines; every request body inspected for leaks; four new languages' header lines removed |
| Photo cleaning | Identifiers painted out and read again; refusal if still readable |
| Languages | Every interface string in all 15 languages; share text adds no numbers |
| Voice | Intents and the redirect line in all 15 languages, including phrases recorded from the real transcriber |

## Real-world checks run during the build

| Check | Result |
|---|---|
| Photo citations on 10 real Quest portal screenshots ([`scripts/review-citations.mjs`](../scripts/review-citations.mjs)) | 47 of 47 rows highlighted correctly |
| 54 simulated phone photos ([`scripts/simulate-phone.mjs`](../scripts/simulate-phone.mjs)) | 53 cited, none wrongly |
| Muse Voice Transcribe on 36 spoken phrases in French, German, Portuguese, Indonesian | 32 correct first time; the 4 misses were fixed and added to the tests |
| Localized PDFs through the running app with the real Muse (French, German, Portuguese, Indonesian, Spanish) | Every row verified, no identifier in what the AI saw |
| Real Muse translation into all four new languages | Summary, questions and explanations accepted by the safety check |

The citation screenshots are health data and are not in the repo, so those two measurements cannot be reproduced from a fresh clone.
