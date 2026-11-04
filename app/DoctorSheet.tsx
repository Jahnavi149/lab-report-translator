'use client';
import { formatRangeCompact, formatValue } from '@/lib/flags';
import { uiFor } from '@/lib/i18n';
import type { LabReport, LabRow, Language } from '@/lib/types';

const LANG_NAME: Record<Language, string> = { en: 'English', te: 'తెలుగు', hi: 'हिन्दी', es: 'Español', ta: 'தமிழ்', kn: 'ಕನ್ನಡ', bn: 'বাংলা', mr: 'मराठी', tl: 'Tagalog', ms: 'Bahasa Melayu', ar: 'العربية', fr: 'Français', de: 'Deutsch', pt: 'Português', id: 'Bahasa Indonesia' };

interface Props {
  report: LabReport;
  language: Language;
  summary: string[];
  questions: string[];
  flagged: LabRow[];
  testDate: string;
  onTestDate: (isoDate: string) => void;
  onBack: () => void;
  onClear: () => void;
}

// Left column: the family's language. Right column: English clinical values for the doctor.
// Everything printed here is either copied from the report or a question for the doctor, never an answer.
/** "2026-03-12" -> "12 March 2026": the month is spelled out so no one has to guess day/month order. */
function printableDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function printDoctorSheet(testDate: string): void {
  const originalTitle = document.title;
  const restoreTitle = () => {
    document.title = originalTitle;
    window.removeEventListener('afterprint', restoreTitle);
  };

  document.title = `Doctor sheet - ${testDate || todayIso()}`;
  window.addEventListener('afterprint', restoreTitle, { once: true });
  window.print();
}

export function DoctorSheet({ report, language, summary, questions, flagged, testDate, onTestDate, onBack, onClear }: Props) {
  const ui = uiFor(language);
  return (
    <section className="card fade">
      <div className="no-print row">
        <button onClick={onBack}>← {ui.backBtn}</button>
        <button className="primary" onClick={() => printDoctorSheet(testDate)}>🖨 {ui.printBtn}</button>
        <button onClick={onClear}>{ui.clearBtn}</button>
      </div>
      <div className="sheet-banner no-print" style={{ marginTop:'20px' }}><strong>Doctor sheet</strong><br />{ui.sheetBanner}</div>
      <h2 style={{ marginTop: 18 }}>{report.title}</h2>
      <p className="lines fill">
        <label htmlFor="test-date">{ui.testDate}</label>{' '}
        <input id="test-date" type="date" className="date-input no-print" value={testDate} max={todayIso()} onChange={(e) => onTestDate(e.target.value)} />
        <span className="print-only">{printableDate(testDate) || '____________________'}</span>
      </p>
      <p className="lines fill" style={{marginBottom: '20px'}}>{ui.mainConcern} ________________________________________</p>
      <div className="sheet-grid">
        <div className="sheet-col">
          <h3>{ui.forFamily(LANG_NAME[language])}</h3>
          <ul>{summary.map((s, i) => <li key={i} dir="auto">{s}</li>)}</ul>
          <h3>{ui.questionsToAsk}</h3>
          <ol>{questions.map((q, i) => <li key={i} dir="auto">{q}</li>)}</ol>
        </div>
        <div className="sheet-col" dir="ltr" lang="en">
          <h3>For the doctor (English)</h3>
          <p className="muted small trust-note">
            {report.source_kind === 'photo'
              ? 'Read from a photo by AI, so every result is marked for checking. Compare with the original report.'
              : 'Values below were read from the report by code, not AI. Flags compare each value with the printed range, or copy the report verdict only when no range is printed.'}
          </p>
          <ul>
            {flagged.map((r) => (
              <li key={r.test_name}>
                <strong>{r.test_name}</strong>: {formatValue(r.value, r.unit)} • Printed range: {formatRangeCompact(r.ref_low, r.ref_high, r.unit, 'not on report')} • {r.flag}
                {r.flag_source === 'report_marker' && ' (flag copied from the report’s own marker)'}
                {r.confidence === 'low' && ' • needs review against the original'}
              </li>
            ))}
            {flagged.length === 0 && <li>No values outside a printed range.</li>}
          </ul>
          <h3>Questions (English)</h3>
          <ol>{report.questions.map((q, i) => <li key={i} dir="auto">{q}</li>)}</ol>
        </div>
      </div>
      <h3>{ui.checklist}</h3>
      <ul className="checklist">
        <li>☐ {ui.bringSheet}</li>
        <li>☐ {ui.bringMeds}</li>
        <li>☐ {ui.bringPrevious}</li>
      </ul>
      <h3>{ui.doctorAnswers}</h3>
      <p className="lines">________________________________________________________________________</p>
      <p className="lines">________________________________________________________________________</p>
      <p className="lines">________________________________________________________________________</p>
      <p className={`muted small${report.is_synthetic ? '' : ' no-print'}`}>
        <span className="no-print">{ui.infoOnly}. </span>
        {report.is_synthetic ? 'SYNTHETIC sample, not a real patient.' : ''}
      </p>
    </section>
  );
}
