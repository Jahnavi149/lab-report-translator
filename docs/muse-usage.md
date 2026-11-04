# How Meta's models are used

[← Back to README](../README.md)

Only Meta models are called at runtime. Both go through the Meta Model API from [`lib/muse.ts`](../lib/muse.ts).

- **Muse Spark** (`muse-spark-1.3`): language jobs. Set with `META_MODEL`.
- **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`): hearing the spoken question. Endpoint `POST https://api.meta.ai/v1/asr/transcribe`.

| Job | Model | What it receives | What it produces | Entry point |
|---|---|---|---|---|
| Photo reading | Muse Spark (vision) | The cleaned photo only | Rows read from the picture | `extractFromImageWithMuse` |
| Explanations | Muse Spark | Test name, value, unit, printed range, flag | One natural sentence per row | `enhanceWithMuse` ([`lib/enhance.ts`](../lib/enhance.ts)) |
| Summary | Muse Spark | The same structured rows | 3-line summary | `enhanceWithMuse` |
| Doctor questions | Muse Spark | The same structured rows | One question per flagged row | `enhanceWithMuse` |
| Translation | Muse Spark | The checked English text | Text in the chosen language | `translateWithMuse`, [`/api/translate`](../app/api/translate/route.ts) |
| Second-pass check | Muse Spark | One row and its own redacted line | Agree or disagree; it can only **lower** confidence | `enhanceWithMuse` |
| Voice answer | Muse Spark | The matched row | The words of one spoken answer (two intents only) | [`/api/voice-ask`](../app/api/voice-ask/route.ts) |
| Hearing | Muse Voice Transcribe | One short WAV recording | Text of the question | `transcribeWithMuse`, [`/api/transcribe`](../app/api/transcribe/route.ts) |

## What Muse never does

- Set a flag, value, unit or range.
- Receive the report text, a file name, or an identifier (see [Privacy](privacy.md)).
- Have the last word: every sentence passes [`lib/safety.ts`](../lib/safety.ts), and failures fall back to code-written text (see [How it works](how-it-works.md)).

## Settings

`.env.example` lists every variable: `META_MODEL_API_KEY`, `META_MODEL_API_URL`, `META_MODEL`, and optional `MUSE_TIMEOUT_MS`, `MUSE_MAX_TOKENS`, `MUSE_REASONING_EFFORT`.
