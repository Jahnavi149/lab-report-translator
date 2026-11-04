import { flagLabel } from './i18n';
import { APP_DATA } from './i18n-app-data';
import type { Flag, Language } from './types';

// Every other sentence the app shows, in all fifteen languages: dialogs, citation viewers, the privacy panel,
// notes, and the messages the server sends back. Report text (summary, questions, explanations) is translated by
// Muse at runtime; the sentences here are fixed, so they cannot be wrong in a new way each time.
//
// Keys starting with "s_" are SERVER messages. The server always answers in English; the page matches each message
// against its English template here and swaps in the same sentence in the user's language. Anything that does not
// match stays English, which is the safe fallback (never a wrong sentence).
//
// {name} marks a value that is filled in: it must appear in every language. A test checks this.
// NOTE: written for this project; have a native speaker review before real-world use.

export const EN_APP = {
  // Page chrome
  tagline: 'Plain language for every family',
  translating: 'Translating…',
  translationUnavailable: 'Translation is unavailable right now, so English is shown.',
  reading: 'Reading your report. This can take up to a minute…',
  uploadAria: 'Upload a lab PDF or photo',
  languageAria: 'Language',
  synthetic: 'SYNTHETIC',

  // Results table
  needsReviewChip: 'Needs review',
  reviewBanner: 'Results marked "Needs review": {n}. Please check them against your original report.',
  linesNotRead: 'Lines not read: {n}. Check them in your original',
  rangeNotOnReport: 'Range not on report',
  notOnReport: 'Not on report',
  sourceCol: 'Source',
  quotedFromPhoto: 'Quoted from your photo:',
  fromYourReport: 'From your report:',
  flagFromMarker: "The {flag} flag was copied from the report's own marker; no range is printed.",
  viewBtn: 'View',
  viewTitle: 'View this result {where}',
  viewAria: 'View {test} {where}',
  noLocation: 'No location available {where}',
  inPdf: 'in the PDF',
  inPhoto: 'in the photo',
  inDocument: 'in the document',

  // Review dialog
  reviewTitle: 'Review {test}',
  close: 'Close',
  closeReview: 'Close result review',
  reviewHelp: 'Review the values against the original document and its citation before approving or rejecting this result.',
  whyReview: 'Why it needs review:',
  valueLabel: 'Value',
  printedRange: 'Printed range',
  flagWord: 'Flag',
  citationHeading: 'Document citation',
  extractedFrom: 'Extracted from:',
  viewCitationIn: 'View citation {where}',
  noCitation: 'A clickable citation is not available for this result. Compare it directly with the original document.',
  rejectResult: 'Reject result',
  approveResult: 'Approve result',
  allReviewed: 'All remaining results were reviewed against the original document.',
  stillNeedReview: 'Results still needing review against the original document: {n}.',

  // Citation viewers
  originalReport: 'Original report',
  sourceFromPage: 'Source selected from page {page}',
  closePdfViewer: 'Close PDF viewer',
  pdfSourceAria: 'Original PDF source',
  previous: 'Previous',
  next: 'Next',
  pageOf: 'Page {page} of {total}',
  pageOnly: 'Page {page}',
  openingPdf: 'Opening PDF…',
  pdfPageAria: 'PDF page {page}',
  pdfCannotShow: 'This PDF could not be shown here. You can still use the extracted results.',
  pdfCannotRender: 'This PDF page could not be rendered.',
  originalPhoto: 'Original photo',
  photoOutlined: 'Outlined: the line this result was read from,',
  closePhotoViewer: 'Close photo viewer',
  photoSourceAria: 'Original photo source',
  photoAlt: 'Your uploaded lab report photo',

  // Photo trim dialog
  cropTitle: 'Trim your photo before reading (optional)',
  cropWarnStrong: 'Before Meta\u2019s Muse AI sees this photo, labelled details (a name or ID next to "Patient Name", "MRN", a phone number, an email, a date of birth) are found on this server and painted out,',
  cropWarnRest: 'and the cleaned picture is read again to check. A name printed with no label cannot be found automatically, so please trim the header away here: the trimmed part never leaves this device. You will see exactly what was sent.',
  cropAlt: 'Your lab report photo. Use the sliders to trim it.',
  trimTop: 'Trim from the top',
  trimBottom: 'Trim from the bottom',
  trimLeft: 'Trim from the left',
  trimRight: 'Trim from the right',
  readCropped: 'Read the cropped photo',
  readAsIs: 'Read this photo as it is',
  resetCrop: 'Reset crop',
  cancel: 'Cancel',

  // "What the AI sees" panel
  privacyAria: 'Privacy',
  photoCleaned: 'Your photo was cleaned before it was sent. Areas with labelled personal details that were painted out: {n}{kinds}.',
  photoChecked: 'Your photo was checked before it was sent: no labelled personal details were found on it.',
  pdfIdsRemoved: 'Identifiers removed from your PDF before its text was sent to the AI: {n}{kinds}.',
  pdfChecked: 'The PDF text was checked for identifiers before it was sent to the AI.',
  photoPanelNote: 'The cleaned picture was read again to make sure nothing that was painted could still be made out. A name printed with no label cannot be found automatically, so trim it away before uploading.',
  pdfPanelNote: 'The AI receives the redacted selectable PDF text so it can identify the result rows. Pattern-based redaction can miss an unlabelled name.',
  voiceSummary: 'Voice questions: {asked} asked, {sent} sent to the AI.',
  voiceHanded: 'Questions redirected to your doctor: {n}.',
  voicePrivacy: 'Only the question text goes, with identifiers removed, plus the test names, values and ranges above. This app never stores your voice. The recording goes to Meta\u2019s Muse Voice Transcribe only to be turned into text (for English questions, with the test names to help it spell them), and is then dropped. If that is unavailable, your browser\u2019s own speech recognition does this step instead; in some browsers, such as Chrome, the browser\u2019s maker handles it.',
  linesWithheld: 'Result lines kept out of the second check because they have extra text: {n}.',
  whatAiSees: 'What the AI sees',
  aiSeesIntro: 'This is everything the AI is given about this report: {items}. The sentences it writes are sent back to it only if you ask for a translation. A spoken question is sent only when you ask it to explain a result or a doctor question.',
  itemCleanedPhoto: 'the cleaned photo',
  itemRedactedPdf: 'the redacted selectable PDF text',
  itemRows: 'test names, values, units and printed ranges',
  itemResultLines: 'each result\u2019s own line',
  aiPhotoAlt: 'The cleaned photo that was sent to the AI. Black boxes cover personal details.',
  kindEmail: 'email',
  kindWeb: 'web address',
  kindIp: 'IP address',
  kindDate: 'date',
  kindPhoneId: 'phone or ID number',
  kindId: 'ID number',
  kindNameLine: 'name or ID line',
  kindAge: 'age over 89',

  // Messages raised in the page itself
  cropError: 'Could not crop that photo.',
  readError: 'Could not read that file.',
  sampleError: 'Could not load the example report.',
  listenUnsupported: 'Listening is not supported in this browser.',
  noVoice: 'This device has no {language} voice installed, so listening may be silent. Install one in your system speech settings, or use the large-print handout.',

  // SERVER messages (matched by their English text, then shown in the user's language)
  s_noResults: 'No results were extracted. Please try a clearer file or the example report.',
  s_couldNotVerify: 'Could not verify these rows against the document text: {list}. They are marked Needs Review. Please check them against your original report.',
  s_verified: 'Every extracted value, unit and printed range was found on its own line of your report.',
  s_museConfirm: "Muse's second check also could not confirm: {list}.",
  s_needsReview: 'Needs review: {problem}.',
  s_pLine: 'its line was not found in the document text',
  s_pValue: 'its value was not found on its line',
  s_pNoValue: 'it has no numeric value or report verdict to verify',
  s_pVerdict: 'its {flag} verdict was not found on its line',
  s_pUnit: 'its unit was not found on its line',
  s_pLow: 'its lower range bound was not found on its line',
  s_pHigh: 'its upper range bound was not found on its line',
  s_museSecond: 'Muse second-pass check could not confirm this row against the document.',
  s_pdfNoValueMarker: "No numeric value or range is printed. The {flag} flag is copied from the report's own verdict.",
  s_noValue: 'No numeric value is printed for this test.',
  s_pdfNoRangeMarker: "No range is printed. The {flag} flag is copied from the report's own verdict.",
  s_noRange: 'No range is printed for this test.',
  s_textNoRangeMarker: "No range is printed. The {flag} flag is copied from the report's own marker.",
  s_rangeUnreadable: 'A number in the printed range could not be read safely, so no range was used. Check it against your original.',
  s_rangeAmbiguous: 'Several different ranges are printed for this test, so none was chosen. Ask your doctor which applies.',
  s_limitValue: 'The report prints this value as a limit ({limit}), not an exact number, so it could not be compared with the printed range. Check it against your original.',
  s_photoNoValueMarker: 'No numeric value or range is shown. The {flag} verdict was read from the photo; check it against the original.',
  s_photoNoRangeMarker: 'No range is shown. The {flag} verdict was read from the photo; check it against the original.',
  s_photoRead: 'Read from a photo: check this row against your original.',
  s_photoMismatch: 'Read from a photo, and the result evidence does not all match the text that was quoted. Check this row against your original.',
  s_photoNote: 'Read from a photo with Muse Spark vision. A photo cannot be checked against document text the way a digital PDF can, so every row is marked Needs Review. Please compare each result with your original report before sharing.',
  s_sampleNote: 'Synthetic report: values, units and ranges are the ones written into the sample.',
  s_tooManyUploads: 'Too many uploads from this connection. Please wait a few minutes and try again.',
  s_chooseFile: 'Please choose a file.',
  s_fileTooBig: 'That file is over 10 MB. Please try a smaller file.',
  s_fileType: 'Please upload a digital PDF or a photo of a lab report (JPG, PNG, or WebP).',
  s_pdfNotConfigured: 'PDF reading is not available right now because the model is not configured.',
  s_pdfNoText: 'No selectable text was found in this PDF. If it is a scan, upload it as an image instead.',
  s_pdfNoSafeText: 'No report text remained after the privacy check. Please try a report with a clearly separated results table.',
  s_pdfNoGrounded: 'No lab results could be grounded in this PDF text. If it is a scan, upload it as an image instead, or try a clearer digital PDF.',
  s_photoUnavailable: 'Photo reading is not available right now. Please upload a digital PDF instead.',
  s_tooManyPhotos: 'Too many photo uploads from this connection. Please wait a few minutes and try again.',
  s_photoNoResults: 'No lab results could be read from this photo. Try a flatter, brighter, closer photo, or upload a digital PDF.',
  s_readFailed: 'Something went wrong reading that file. Please try again, or try the example report.',
  s_refuseNoOcr: 'The photo privacy check could not run, so the photo was not sent anywhere. Please upload a digital PDF instead, or try again.',
  s_refuseLittleText: 'Not enough printed text could be read on this photo to check it for personal details, so it was not sent anywhere. Try a flatter, brighter, closer photo, or upload a digital PDF.',
  s_refuseUnsettled: 'Some personal details on this photo could not be covered reliably, so it was not sent anywhere. Crop your name and ID out of the photo and try again, or upload a digital PDF.',
  s_refuseBadImage: 'That image could not be read. Please try another photo, or upload a digital PDF.',
  s_askQuestion: 'Please ask a question.',
  s_questionTooLong: 'That question is too long. Please ask a shorter one.',
  s_voiceLang: 'That language is not supported for voice questions.',
  s_openReportFirst: 'Open a report first, then ask about it.',
  s_invalid: 'Invalid request.',
  s_tooLarge: 'Request too large.',
  s_voiceUnavailable: 'Voice questions are not available right now.',
  s_tooManyVoice: 'Too many voice questions from this connection. Please wait a few minutes and try again.',
  s_aiCouldNotAnswer: 'The AI could not answer just now. Please try again in a moment.',
  s_recTooLong: 'That recording is too long. Please ask a shorter question.',
  s_recEmpty: 'The recording was empty.',
  s_recNotWav: 'The recording was not a WAV file.',
  s_recBadWav: 'The recording was not a valid WAV file.',
  s_recFormat: 'The recording must be mono 16-bit audio at 16 or 24 kHz.',
  s_recTooShort: 'The recording was too short.',
  s_recFailed: 'The recording could not be turned into text just now. Please try again in a moment.',
  s_tooManyTranslations: 'Too many translation requests. Please wait a few minutes.',
  s_translationUnavailable: 'Translation is not available.',
  s_unsupportedLang: 'Unsupported language.',
  s_translationFailed: 'Translation failed.',
} as const;

export type AppKey = keyof typeof EN_APP;
export const APP_KEYS = Object.keys(EN_APP) as AppKey[];

const PACKS = APP_DATA as Partial<Record<Language, Partial<Record<AppKey, string>>>>;

/** Replaces each {name} in a sentence. A missing value leaves the placeholder visible, which a test would catch. */
export function fill(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** The app text for a language, English wherever a sentence is missing. */
export function appText(lang: Language): (key: AppKey, vars?: Record<string, string | number>) => string {
  const pack = lang === 'en' ? undefined : PACKS[lang];
  return (key, vars) => fill(pack?.[key] ?? EN_APP[key], vars);
}

// ---- Server messages ------------------------------------------------------------------------------------------

// Besides the server's own messages, a few page messages are stored in English (in state or in the report) and shown
// translated at render time, so switching language after an error still shows the new language.
const STORED_IN_ENGLISH: AppKey[] = ['allReviewed', 'stillNeedReview', 'cropError', 'readError', 'sampleError', 'listenUnsupported', 'noVoice'];
const SERVER_KEYS = APP_KEYS.filter((k) => (k.startsWith('s_') && k !== 's_museConfirm') || STORED_IN_ENGLISH.includes(k));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Template { key: AppKey; re: RegExp; names: string[] }
function compile(key: AppKey): Template {
  const names: string[] = [];
  const source = EN_APP[key].split(/(\{\w+\})/).map((part) => {
    const m = /^\{(\w+)\}$/.exec(part);
    if (!m) return escapeRe(part);
    names.push(m[1]!);
    return '(.+?)';
  }).join('');
  return { key, re: new RegExp(`^${source}$`, 's'), names };
}
const TEMPLATES = SERVER_KEYS.map(compile);
const MUSE_CONFIRM = compile('s_museConfirm');

function localizeOne(text: string, lang: Language): string | null {
  for (const t of TEMPLATES) {
    const m = t.re.exec(text);
    if (!m) continue;
    const vars: Record<string, string> = {};
    t.names.forEach((name, i) => {
      const v = m[i + 1]!;
      vars[name] = name === 'flag' ? flagLabel(lang, v as Flag) : name === 'problem' ? (localizeOne(v, lang) ?? v) : v;
    });
    return appText(lang)(t.key, vars);
  }
  return null;
}

/** Shows a server message (or a page message stored in English) in the user's language. Unknown text is returned unchanged (English). */
export function localizeServerText(text: string, lang: Language): string {
  if (lang === 'en' || !text) return text;
  const whole = localizeOne(text, lang);
  if (whole) return whole;
  // A verification note can carry Muse's second-check sentence after it, separated by a space.
  const cut = text.indexOf(" Muse's second check also could not confirm:");
  if (cut > 0) {
    const head = localizeOne(text.slice(0, cut), lang);
    const m = MUSE_CONFIRM.re.exec(text.slice(cut + 1));
    if (head && m) return `${head} ${appText(lang)('s_museConfirm', { list: m[1]! })}`;
  }
  return text;
}
