'use client';
import { formatRangeCompact } from '@/lib/flags';
import { uiFor } from '@/lib/i18n';
import type { LabReport, LabRow, Language } from '@/lib/types';

const LANG_NAME: Record<Language, string> = { en: 'English', te: 'తెలుగు', hi: 'हिन्दी', es: 'Español', ta: 'தமிழ்', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', bn: 'বাংলা', mr: 'मराठी' };

interface Props {
  report: LabReport;
  language: Language;
  summary: string[];
  questions: string[];
  flagged: LabRow[];
  recheckDate: string;
  onBack: () => void;
  onClear: () => void;
}

// Left column: the family's language. Right column: English clinical values for the doctor.
// Everything printed here is either copied from the report or a question for the doctor, never an answer.
export function DoctorSheet({ report, language, summary, questions, flagged, recheckDate, onBack, onClear }: Props) {
  const ui = uiFor(language);
  return (
    <section className="card fade">
      <div className="no-print row">
        <button onClick={onBack}>← {ui.backBtn}</button>
        <button className="primary" onClick={() => window.print()}>🖨 {ui.printBtn}</button>
        <button onClick={onClear}>{ui.clearBtn}</button>
      </div>
      <div className="sheet-banner"><strong>Doctor sheet</strong><br />{ui.sheetBanner}</div>
      <h2 style={{ marginTop: 18 }}>{report.title}</h2>
      <div className="sheet-grid">
        <div className="sheet-col">
          <h3>{ui.forFamily(LANG_NAME[language])}</h3>
          <ul>{summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
          <h3>{ui.questionsToAsk}</h3>
          <ol>{questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
        </div>
        <div className="sheet-col">
          <h3>For the doctor (English)</h3>
          <ul>
            {flagged.map((r) => (
              <li key={r.test_name}>
                <strong>{r.test_name}</strong>: {r.value} {r.unit} • Printed range: {formatRangeCompact(r.ref_low, r.ref_high, r.unit, 'not on report')} • {r.flag}
                {r.flag_source === 'report_marker' && ' (flag copied from the report’s own marker)'}
                {r.confidence === 'low' && ' • needs review against the original'}
              </li>
            ))}
            {flagged.length === 0 && <li>No values outside a printed range.</li>}
          </ul>
          <h3>Questions (English)</h3>
          <ol>{report.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
        </div>
      </div>
      <h3>{ui.checklist}</h3>
      <ul className="checklist">
        <li>☐ {ui.bringSheet}</li>
        <li>☐ {ui.bringMeds}</li>
        <li>☐ {ui.bringPrevious}</li>
        {recheckDate && <li>☐ {ui.recheck}: {recheckDate}</li>}
      </ul>
      <h3>{ui.doctorAnswers}</h3>
      <p className="lines">________________________________________________________________________</p>
      <p className="lines">________________________________________________________________________</p>
      <p className="lines">________________________________________________________________________</p>
      <p className="muted small">{ui.infoOnly}. {report.is_synthetic ? 'SYNTHETIC sample, not a real patient.' : ''}</p>
    </section>
  );
}
