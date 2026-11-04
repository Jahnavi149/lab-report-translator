# Ask by voice

[← Back to README](../README.md)

Press the microphone, ask one short question, and get the answer aloud and in text. Works in all 15 languages.

## Four things it understands

1. **Explain a result:** "What does my hemoglobin mean?"
2. **Read the summary:** "Read me the summary."
3. **Rephrase a doctor question** in simpler words: "Explain the second question."
4. **Navigate:** "Take me to the doctor sheet", "Open large print", "Switch to French".

Anything else, and anything about what to do, gets one fixed reply and no answer:

> "I can only explain what's printed on your report. For anything about what to do, please ask your doctor — I can help you write the question down."

The reply, "which test?", "which question?" and page confirmations come back in the user's language, with the English text kept beside them.

## How it works

```
microphone ─► WAV ─► /api/transcribe ─► Muse Voice Transcribe ─► text
text ─► code keyword matcher picks the intent ─► (Muse writes words for two intents) ─► safety check ─► spoken
```

- **Hearing:** Muse Voice Transcribe, one language at a time, up to 15 seconds, stopped by a pause. Audio is held in memory for that request only. For English, the report's test names are sent to help spelling.
- **Understanding:** code decides the intent ([`lib/voice.ts`](../lib/voice.ts)) before any model is called. Word lists per language are in [`lib/voice-lang.ts`](../lib/voice-lang.ts); fixed lines in [`lib/voice-text.ts`](../lib/voice-text.ts).
- **Answering:** the two explain intents use Muse for the words, and every answer passes [`lib/safety.ts`](../lib/safety.ts) first. A mis-heard word can at worst produce the fixed reply above.
- **Speaking:** the browser's `speechSynthesis`. If transcription is unavailable, the browser's own speech recognition takes over.
- **Voice and privacy:** the transcript passes the identifier check before any language model sees it.

## Checked against real transcriber output

Phrases in Tamil, Kannada, Bengali, Malay, Arabic, French, German, Portuguese, Indonesian, English, Telugu, Hindi and Spanish were spoken with synthetic voices, run through the real Muse Voice Transcribe, and added to the test suite exactly as heard (including its small mistakes). Marathi and Tagalog are tested on typed phrases.
