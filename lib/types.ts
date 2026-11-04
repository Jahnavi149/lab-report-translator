export type Flag = 'Normal' | 'High' | 'Low' | 'Unknown';
export type ReportedVerdict = Exclude<Flag, 'Unknown'>;
export type Confidence = 'high' | 'low';
export type Language = 'en' | 'te' | 'hi' | 'es' | 'ta' | 'kn' | 'bn' | 'mr' | 'tl' | 'ms' | 'ar' | 'fr' | 'de' | 'pt' | 'id';
export type FlagSource = 'range' | 'report_marker' | 'none';

/** A location in the original PDF. Rectangles use PDF coordinates (origin at bottom-left). */
export interface PdfSourceAnchor {
  page: number;
  rects: { x: number; y: number; width: number; height: number }[];
}

/** A location in an uploaded photo, as fractions of the image (0 to 1) from its top-left corner. */
export interface ImageSourceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const LANGUAGES: Language[] = ['en', 'te', 'hi', 'es', 'ta', 'kn', 'bn', 'mr', 'tl', 'ms', 'ar', 'fr', 'de', 'pt', 'id'];

export interface LabRow {
  test_name: string;
  /** Some patient portals show only a verdict (for example HIGH) and omit the numeric result. */
  value: number | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  flag: Flag;
  /** Where the flag came from: the printed range, the report's own H/L marker, or nowhere. */
  flag_source?: FlagSource;
  plain_english: string;
  confidence: Confidence;
  /** Set whenever confidence is low, so the UI can say exactly why. */
  review_reason?: string;
  source_text: string;
  source_anchor?: PdfSourceAnchor;
  /** Photo uploads only: where the model says this line is in the image. Never used for values or flags. */
  source_box?: ImageSourceBox;
}

export interface LabReport {
  id: string;
  title: string;
  is_synthetic: boolean;
  rows: LabRow[];
  summary: string[];
  questions: string[];
  verification_passed: boolean;
  verification_note: string;
  source_note: string;
  muse_used?: boolean;
  muse_features?: string[];
  /** Lines that looked like results but could not be read safely. */
  skipped_lines?: string[];
  source_kind?: 'pdf' | 'photo';
  ai_input?: AiInputDisclosure;
}

// --- Privacy types --------------------------------------------------------------------------------
// Muse call sites accept ONLY these branded inputs: a LabRow or a plain string does not typecheck, and the only
// code that can create them is lib/privacy.ts (rows and PDF text) and lib/safety.ts (individual lines).
// So unredacted report text cannot reach the model by accident; PDF text must first become MuseSafeReportText.
declare const museSafe: unique symbol;
/** The fields Muse may see about one result. No source line, no file name, no free text. */
export type MuseSafeRow = Pick<LabRow, 'test_name' | 'value' | 'unit' | 'ref_low' | 'ref_high' | 'flag'> & { readonly [museSafe]: true };
/** One report line with identifying lines and patterns already removed. */
export type MuseSafeLine = string & { readonly [museSafe]: true };
/** Complete selectable PDF text after the local identifier redactor has processed it. */
export type MuseSafeReportText = string & { readonly [museSafe]: true };

/**
 * A photo that went through lib/photo.ts: identifiers found by the patterns are painted out of the
 * pixels, and a second read of the painted image found none left. The vision call accepts nothing else, so an
 * original upload cannot be sent by mistake. Only lib/photo.ts can create one.
 */
export interface RedactedPhoto {
  readonly [museSafe]: true;
  readonly buffer: Buffer;
  readonly mime: 'image/jpeg';
  /** How many text boxes were painted out. */
  readonly regions: number;
  /** What kinds of identifier those were (never the values). */
  readonly kinds: string[];
  /** A small copy of exactly what was sent, for the "What the AI sees" panel. */
  readonly preview: string;
}

/** Exactly what the AI was given for a report, shown to the user under "What the AI sees". */
export interface AiInputDisclosure {
  /** The result fields sent to Muse (name, value, unit, range, flag). */
  rows: Pick<LabRow, 'test_name' | 'value' | 'unit' | 'ref_low' | 'ref_high' | 'flag'>[];
  /** PDF only: the redacted result lines sent for the second-pass check. */
  source_lines: string[];
  /** Photo uploads: a picture is sent to be read, after identifiers were painted out of it (see photo_preview). */
  photo: boolean;
  /** Digital PDFs: the exact redacted selectable text sent to Muse for row extraction. */
  redacted_report_text?: string;
  /** Photo uploads: the exact image sent, as a small data URL. */
  photo_preview?: string;
  /** Photo uploads: how many regions were painted out. */
  photo_regions?: number;
  /** Result lines kept out of the second check because they held text that could not be explained as a result. */
  lines_withheld: number;
  /** How many identifier lines or patterns were found in the report text and kept away from the AI. */
  identifiers_removed: number;
  /** What kinds of identifier those were (never the values), e.g. "name or ID line", "date". */
  removed_kinds: string[];
}

/** Muse translation, item by item. A null item failed validation and stays in English. */
export interface TranslatedReport {
  summary: (string | null)[];
  questions: (string | null)[];
  explanations: Record<string, string>;
}

/** One spoken question and its answer, kept in the browser for the "What the AI sees" panel (counts and text, never audio). */
export interface VoiceExchange {
  question: string;
  answer: string;
  intent: string;
  redirected: boolean;
  /** The question text reached Muse (only explain-result and explain-question do this). */
  sent_to_ai: boolean;
  /** Exactly what was sent, after identifiers were removed. */
  question_sent?: string;
}

/** One spoken question and its answer, kept in the browser for the "What the AI sees" panel (counts and text, never audio). */
export interface VoiceExchange {
  question: string;
  answer: string;
  intent: string;
  redirected: boolean;
  /** The question text reached Muse (only explain-result and explain-question do this). */
  sent_to_ai: boolean;
  /** Exactly what was sent, after identifiers were removed. */
  question_sent?: string;
}
