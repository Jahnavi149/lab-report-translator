'use client';
import { flagLabel, uiFor } from '@/lib/i18n';
import { appText } from '@/lib/i18n-app';
import { formatRangeCompact, formatValue } from '@/lib/flags';
import type { LabReport, LabRow, Language } from '@/lib/types';

interface Props {
  report: LabReport;
  language: Language;
  summary: string[];
  questions: string[];
  explain: (row: LabRow) => string;
  onBack: () => void;
}

// One large-print page in the family's language: what each result was, what the report printed, and what to ask.
// No clinical interpretation: every sentence is the same text shown on the results screen.
export function FamilyHandout({ report, language, summary, questions, explain, onBack }: Props) {
  const ui = uiFor(language);
  return (
    <section className="card fade handout">
      <div className="no-print row">
        <button onClick={onBack}>← {ui.backBtn}</button>
        <button className="primary" onClick={() => window.print()}>🖨 {ui.printBtn}</button>
      </div>
      <h2>{ui.handoutTitle}</h2>
      <p className="handout-sub">{report.title}{report.is_synthetic ? ` · ${appText(language)('synthetic')}` : ''}</p>
      <ul className="handout-summary">{summary.map((s, i) => <li key={i} dir="auto">{s}</li>)}</ul>
      <div className="handout-rows">
        {report.rows.map((r) => (
          <div key={r.test_name} className={`handout-row ${r.flag}`}>
            <div className="handout-name">{r.test_name}</div>
            <div className="handout-value">{formatValue(r.value, r.unit, undefined, r.qualifier)}</div>
            <div className="handout-range">{formatRangeCompact(r.ref_low, r.ref_high, r.unit, '—')}</div>
            <div><span className={`flag ${r.flag}`}>{flagLabel(language, r.flag)}</span></div>
            <div className="handout-text" dir="auto">{explain(r)}</div>
          </div>
        ))}
      </div>
      <h3>{ui.questionsToAsk}</h3>
      <ol className="handout-questions">{questions.map((q, i) => <li key={i} dir="auto">{q}</li>)}</ol>
      <p className="handout-foot"><strong>{ui.notMeanTitle}</strong> {ui.notMeanBody}</p>
    </section>
  );
}
