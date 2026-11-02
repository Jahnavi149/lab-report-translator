export type Flag = 'Normal' | 'High' | 'Low' | 'Unknown';
export type Confidence = 'high' | 'low';
export type Language = 'en' | 'te' | 'hi' | 'es' | 'ta' | 'kn' | 'ml' | 'bn' | 'mr';
export type FlagSource = 'range' | 'report_marker' | 'none';

export const LANGUAGES: Language[] = ['en', 'te', 'hi', 'es', 'ta', 'kn', 'ml', 'bn', 'mr'];

export interface LabRow {
  test_name: string;
  value: number;
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
}

/** Muse translation, item by item. A null item failed validation and stays in English. */
export interface TranslatedReport {
  summary: (string | null)[];
  questions: (string | null)[];
  explanations: Record<string, string>;
}
