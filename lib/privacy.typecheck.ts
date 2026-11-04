// Compile-time test, never imported. `npm run build` type-checks it: if any line below STOPS being an error,
// the build fails with "Unused '@ts-expect-error' directive", which means raw text or rows could reach Muse.
import { answerVoiceWithMuse, explainWithMuse, extractFromImageWithMuse, verifyWithMuse } from './muse';
import type { LabRow } from './types';

declare const row: LabRow;
// @ts-expect-error a raw LabRow must not be accepted by a Muse function
void explainWithMuse([row]);
// @ts-expect-error raw report text must not be accepted by the second-pass check
void verifyWithMuse('Patient Name: Rahul');
// @ts-expect-error a plain row-shaped object is not a MuseSafeRow; only lib/privacy.ts can make one
void explainWithMuse([{ test_name: 'x', value: 1, unit: '', ref_low: null, ref_high: null, flag: 'Normal' }]);
// @ts-expect-error an original upload (a Buffer) must not reach the vision model; only a RedactedPhoto from lib/photo.ts can
void extractFromImageWithMuse(Buffer.from('raw upload'));
// @ts-expect-error a hand-made object is not a RedactedPhoto either
void extractFromImageWithMuse({ buffer: Buffer.from('x'), mime: 'image/jpeg', regions: 0, kinds: [], preview: '' });
// @ts-expect-error a raw spoken question (a plain string) must not reach the voice call; it has to pass lib/safety.ts first
void answerVoiceWithMuse({ system: 's', question: 'what is my name', rows: [] });
// @ts-expect-error raw rows must not reach the voice call either
void answerVoiceWithMuse({ system: 's', question: 'x' as never, rows: [row] });
