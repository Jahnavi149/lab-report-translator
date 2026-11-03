// Compile-time test, never imported. `npm run build` type-checks it: if any line below STOPS being an error,
// the build fails with "Unused '@ts-expect-error' directive", which means raw text or rows could reach Muse.
import { explainWithMuse, verifyWithMuse } from './muse';
import type { LabRow } from './types';

declare const row: LabRow;
// @ts-expect-error a raw LabRow must not be accepted by a Muse function
void explainWithMuse([row]);
// @ts-expect-error raw report text must not be accepted by the second-pass check
void verifyWithMuse('Patient Name: Rahul');
// @ts-expect-error a plain row-shaped object is not a MuseSafeRow; only lib/privacy.ts can make one
void explainWithMuse([{ test_name: 'x', value: 1, unit: '', ref_low: null, ref_high: null, flag: 'Normal' }]);
