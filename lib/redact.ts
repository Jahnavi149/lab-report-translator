import type { MuseSafeLine } from './types';

// Layer 2 of the privacy design (see README, "Privacy"): a pure, testable redactor. No network, no env.
// Digital-PDF extraction deliberately sends complete selectable text through this redactor before it reaches Muse.
// This module also protects the one free-text line per result used by the second-pass check.
//
// What it does, in order, for every line:
//   1. Normalises the text so tricks do not hide an identifier: Unicode compatibility forms (full-width letters and
//      digits), zero-width and soft-hyphen characters, odd dashes, and letter-spaced words ("P a t i e n t").
//   2. Drops the whole line if it carries a labelled identifier, in English, Spanish or an Indian language
//      (name, date of birth, record/account/lab numbers, contact details, address, relatives, insurance, doctor), or
//      a titled name ("Mr. Rao").
//   3. In lines that stay, masks emails, URLs, IP addresses, dates in many formats, phone numbers, long digit runs
//      and ID-style tokens, and generalises ages over 89 (the HIPAA Safe Harbor rule).
//
// What is deliberately KEPT: age (89 and under) and sex. Many reference ranges depend on them and they do not
// identify a person alone. Result values and printed reference ranges are kept intact (see isLabRange).
//
// Honest limit: this is pattern matching. A name printed inside a result line with no label is NOT recognised here;
// lib/privacy.ts catches that case separately by refusing to send any line with words it cannot explain.

export interface Removal { kind: string; text: string }

// --- 1. Labels -----------------------------------------------------------------------------------------
// Each entry is a regex fragment. Unicode-aware boundaries (not \b) are used because \b does not work for Indian scripts.
const EN = [
  'patients?', 'names?', 'surname', 'forename', 'given\\s+name', 'full\\s+name', 'first\\s+name', 'last\\s+name', 'nick\\s*name', 'initials',
  'dob', 'd\\.\\s*o\\.\\s*b', 'date\\s+of\\s+birth', 'birth(?:\\s*date)?', 'born',
  'mrn', 'uhid', 'ssn', 'aadhaar', 'aadhar', 'pan', 'passport', 'driver', 'licen[cs]e', 'voter', 'npi', 'nhs', 'ohip', 'medicare', 'medicaid', 'health\\s+card',
  'address', 'street', 'road', 'city', 'district', 'pin\\s*code', 'zip', 'postal', 'phone', 'mobile', 'tel', 'fax', 'contact', 'emergency', 'next\\s+of\\s+kin',
  'e-?mail',
  'insurance', 'insured', 'policy', 'member', 'subscriber', 'claim', 'guarantor', 'invoice', 'bill\\s*no', 'receipt', 'token',
  'referred', 'referring', 'physician', 'doctor', 'dr', 'requested\\s+by', 'consultant', 'collected', 'accession', 'barcode', 'qr',
  'sample\\s+id', 'sample\\s+no', 'specimen\\s+id', 'order\\s+(?:no|id)', 'case\\s*no', 'file\\s*no', 'card\\s*no', 'op\\s*no', 'ip\\s*no',
  'account', 'acct', 'visit', 'encounter', 'registration', 'reg\\.?\\s*no', 'lab\\.?\\s*no',
  'bed', 'ward', 'hospital', 'clinic', 'nationality', 'religion', 'occupation', 'employer',
  'guardian', 'father', 'mother', 'husband', 'wife', 'spouse', 'relationship', 's\\/o', 'w\\/o', 'd\\/o', 'c\\/o',
  'id',
];
const OTHER_LANGUAGES = [
  // Spanish
  'nombre', 'apellidos?', 'paciente', 'nacimiento', 'tel[eé]fono', 'celular', 'm[oó]vil', 'direcci[oó]n', 'domicilio', 'correo', 'c[eé]dula', 'dni', 'seguro', 'p[oó]liza', 'padre', 'madre', 'esposo', 'esposa',
  // Hindi / Marathi
  'नाम', 'नाव', 'रोगी', 'रुग्ण', 'मरीज\u093C?', 'जन्म', 'फ\u093C?ोन', 'दूरध्वनी', 'मोबाइल', 'पता', 'पत्ता', 'ईमेल', 'पिता', 'माता', 'पति', 'पत्नी', 'आधार',
  // Telugu
  'పేరు', 'రోగి', 'పుట్టిన', 'ఫోన్', 'మొబైల్', 'చిరునామా', 'ఇమెయిల్', 'తండ్రి', 'భర్త', 'ఆధార్',
  // Tamil
  'பெயர்', 'நோயாளி', 'பிறந்த', 'தொலைபேசி', 'கைபேசி', 'முகவரி', 'மின்னஞ்சல்', 'தந்தை', 'கணவர்',
  // Kannada
  'ಹೆಸರು', 'ರೋಗಿ', 'ಜನ್ಮ', 'ದೂರವಾಣಿ', 'ಮೊಬೈಲ್', 'ವಿಳಾಸ', 'ತಂದೆ',
  // Malayalam
  'പേര്', 'രോഗി', 'ജനന', 'ഫോൺ', 'മൊബൈൽ', 'വിലാസം', 'അച്ഛൻ',
  // Bengali
  'নাম', 'রোগী', 'জন্ম', 'ফোন', 'মোবাইল', 'ঠিকানা', 'পিতা', 'স্বামী',
];
const WORD = '\\p{L}\\p{M}\\p{N}';
const LABELS = new RegExp(`(?<![${WORD}])(?:${[...EN, ...OTHER_LANGUAGES].map((s) => s.normalize('NFKC')).join('|')})(?![${WORD}])`, 'iu');

// "Mr. Rao", "MRS LAKSHMI", "Smt Devi": a courtesy title followed by a capitalised word is a person's name.
const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Mx', 'Master', 'Smt', 'Shri', 'Sri', 'Shrimati', 'Kumari', 'Sh', 'Baby', 'Prof', 'Sra', 'Srta', 'Don', 'Herr', 'Frau'];
const TITLED_NAME = new RegExp(`(?<![${WORD}])(?:${TITLES.flatMap((t) => [t, t.toUpperCase()]).join('|')})\\.?\\s+\\p{Lu}[\\p{L}\\p{M}'-]+`, 'u');

// --- 2. Normalisation ----------------------------------------------------------------------------------
/** Undoes tricks that hide a label from a regex. Never changes digits or letters other than to their plain forms. */
function normalizeForRedaction(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-');
}
/** "P a t i e n t  N a m e" -> "Patient  Name". Only used to test for labels, never to rewrite the line. */
function squashLetterSpacing(line: string): string {
  return line.replace(new RegExp(`(?<![${WORD}])(?:\\p{L} ){2,}\\p{L}(?![${WORD}])`, 'gu'), (m) => m.replace(/ /g, ''));
}

/** True for a line that carries a labelled identifier or a titled name. The parser uses this too, so "MRN 00481516" is never read as a result. */
export function isIdentifyingLine(line: string): boolean {
  const n = normalizeForRedaction(line);
  return LABELS.test(n) || TITLED_NAME.test(n) || LABELS.test(squashLetterSpacing(n));
}

// --- 3. Patterns inside lines that stay ----------------------------------------------------------------
// One neutral placeholder. Named ones such as "[email]" or "[id]" would themselves look like labels to a second pass.
const REDACTED = '[redacted]';
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
/**
 * A printed reference range such as "12.0 - 15.5", "3.4 - 10.8" or "150000 - 450000" must reach the checker intact.
 * It is a range if it is two plain numbers around a dash AND is written like one: it has a decimal point, spaces
 * around the dash, or both sides are short. "98765-43210" and "040-23456789" (unspaced, long) still count as
 * phone-style numbers and are masked.
 */
export function isLabRange(s: string): boolean {
  const m = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/.exec(s.trim());
  if (!m) return false;
  const [, a = '', b = ''] = m;
  const digits = (x: string) => x.replace('.', '').length;
  const spaced = /\s-\s/.test(s);
  const decimal = a.includes('.') || b.includes('.');
  const short = digits(a) <= 4 && digits(b) <= 4;
  return digits(a) <= 7 && digits(b) <= 7 && (spaced || decimal || short);
}

/** A run of digits and separators is a phone/ID number, not a result, if it is long enough and looks like one. */
function isPhoneOrId(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '').length;
  if (digits < 9) return false;
  const plus = candidate.includes('+');
  // Two decimals separated by spaces ("1.1 0.8 - 1.2") are results. "555.123.4567" has two dots in one token, so it is not a decimal.
  if (!plus && candidate.split(/\s+/).some((t) => /^\d+\.\d+$/.test(t))) return false;
  if (isLabRange(candidate)) return false;
  // Phones and IDs have a token of 4+ digits or a + / ( marker. Three short numbers ("140 135 - 145") are results.
  return plus || candidate.includes('(') || /\d{4}/.test(candidate);
}

/**
 * A run of digits and separators can hold a phone number right beside result numbers ("1.7 - 2.2 (040) 2345 6789"),
 * so look at every window of up to 8 neighbouring tokens, longest first, and mask only the window that is a phone/ID.
 */
function maskPhoneWindows(run: string, removed: Removal[]): string {
  const tokens = [...run.matchAll(/\S+/g)].map((t) => ({ start: t.index ?? 0, end: (t.index ?? 0) + t[0].length }));
  if (tokens.length > 200) return run; // not a real result line; toMuseSafeLine refuses long lines outright
  let out = '', pos = 0, k = 0;
  while (k < tokens.length) {
    let hit = 0;
    for (let len = Math.min(8, tokens.length - k); len >= 1; len--) {
      if (isPhoneOrId(run.slice(tokens[k]!.start, tokens[k + len - 1]!.end))) { hit = len; break; }
    }
    if (hit === 0) { k++; continue; }
    const start = tokens[k]!.start, end = tokens[k + hit - 1]!.end;
    removed.push({ kind: 'phone or ID number', text: run.slice(start, end) });
    out += run.slice(pos, start) + REDACTED;
    pos = end; k += hit;
  }
  return out + run.slice(pos);
}

/** One ID-style token: starts with a capital letter and holds 4+ digits, such as AC-99120045, L-2026-00991, K1234567, ABCDE1234F. HbA1c, CA-125 and B12 are far too short. */
function isIdToken(token: string): boolean {
  return token.length >= 6 && /^[A-Z]/.test(token) && (token.match(/\d/g) ?? []).length >= 4;
}

type Masker = (re: RegExp, kind: string, replacement: string, test?: (m: string) => boolean) => void;

/** Masks identifying patterns inside a line that is otherwise kept. */
function maskPatterns(line: string, removed: Removal[]): string {
  let out = line;
  const mask: Masker = (re, kind, replacement, test) => {
    out = out.replace(re, (m) => {
      if (test && !test(m)) return m;
      removed.push({ kind, text: m });
      return replacement;
    });
  };
  // Anchored at the start of a token (lookbehind) so a long run of letters is scanned once, not once per character.
  mask(/(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, 'email', REDACTED);
  mask(/(?<![\w.+-])[\w.+-]+\s*[[(]\s*at\s*[\])]\s*[\w.-]+/gi, 'email', REDACTED);
  mask(/\b(?:https?:\/\/|www\.)\S+/gi, 'web address', REDACTED);
  mask(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, 'IP address', REDACTED);
  // Dates, most specific first.
  mask(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, 'date', REDACTED);
  mask(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/g, 'date', REDACTED);
  mask(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2}\b/g, 'date', REDACTED);
  mask(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?[ ,.-]*${MONTH}[ ,.-]+\\d{2,4}\\b`, 'gi'), 'date', REDACTED);
  mask(new RegExp(`\\b${MONTH}\\.? \\d{1,2}(?:st|nd|rd|th)?,? \\d{2,4}\\b`, 'gi'), 'date', REDACTED);
  // Phone numbers and long digit runs. A decimal or a lab range is a result and is kept.
  out = out.replace(/\+?\(?\d[\d\s().-]{7,}\d/g, (run) => maskPhoneWindows(run, removed));
  mask(/(?<![\w.])\d{8,}(?![\w.])/g, 'phone or ID number', REDACTED);
  mask(/(?<![\w-])[A-Za-z0-9][A-Za-z0-9/_-]{4,}[A-Za-z0-9](?![\w-])/g, 'ID number', REDACTED, isIdToken);
  // HIPAA Safe Harbor: ages over 89 are identifying, so they are generalised. Ages 89 and under are kept.
  out = out.replace(/\b(age[d]?\s*[:-]?\s*)(\d{2,3})\b(?!\+)/gi, (m, label: string, n: string) => {
    if (Number(n) < 90) return m;
    removed.push({ kind: 'age over 89', text: m });
    return `${label}90+`;
  });
  return out;
}

/**
 * Drops identifying lines and masks identifying patterns in the rest, and reports what it removed so the UI can show
 * an honest count. `removed[].kind` is safe to show; `removed[].text` is the removed value itself and must never be
 * logged, sent to the browser or sent to a model.
 */
export function redactWithAudit(text: string): { redacted: string; removed: Removal[] } {
  const removed: Removal[] = [];
  const kept: string[] = [];
  for (const raw of normalizeForRedaction(text).split(/\r?\n/)) {
    if (isIdentifyingLine(raw)) { if (raw.trim()) removed.push({ kind: 'name or ID line', text: raw }); continue; }
    kept.push(maskPatterns(raw, removed));
  }
  return { redacted: kept.join('\n'), removed };
}

export function redactForMuse(text: string): string {
  return redactWithAudit(text).redacted;
}

/**
 * One result line, cleaned for the second-pass check. Returns null if the line itself carried an identifier
 * (it is then not sent at all; the row simply is not second-checked).
 */
export function toMuseSafeLine(line: string): MuseSafeLine | null {
  if (line.length > 400) return null; // a real result line is short; anything longer is not sent
  const { redacted, removed } = redactWithAudit(line);
  if (removed.some((r) => r.kind === 'name or ID line') || redacted.trim() === '') return null;
  return redacted.trim() as MuseSafeLine;
}

/** True if free text (a test name) carries an identifier and so must not be sent to a model. */
export function looksIdentifying(text: string): boolean {
  return redactWithAudit(text).removed.length > 0;
}

// --- 4. Unexplained words (fail closed) ----------------------------------------------------------------
// A result line is: test name, value, unit, a printed range, maybe an H/L flag or a word like "Optimal". If a line holds
// any other word, it could be a name, so the line is not sent. This is what catches an unlabeled name in a result line.
const RESULT_WORDS = new Set((
  'high low normal abnormal critical final pending flag flags ref range reference result results optimal borderline desirable near above below very elevated ' +
  'deficient sufficient insufficient adequate acceptable target goal intermediate moderate mild severe average good fair optimum limit cutoff cut off ' +
  'male female men women adult adults child children infant newborn fasting random positive negative detected reactive nonreactive non ' +
  'to and or of the for in at less more than equal greater lower upper up under over per ' +
  'mg dl ml ng pg ug mcg gm g l ul iu u mmol umol nmol pmol meq mm hr hrs min sec fl pl cells cu mol dl percent ratio index titer ' +
  'redacted'
).split(' '));

/** Words in a result line that are not the test name, its unit or ordinary result vocabulary. */
export function unexplainedWords(line: string, row: { test_name: string; unit: string }): string[] {
  let rest = normalizeForRedaction(line).toLowerCase();
  for (const known of [row.test_name, row.unit]) if (known) rest = rest.split(normalizeForRedaction(known).toLowerCase()).join(' ');
  return (rest.match(/\p{L}[\p{L}\p{M}'-]*/gu) ?? []).filter((w) => w.length >= 2 && !RESULT_WORDS.has(w));
}
