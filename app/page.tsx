'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { compareReports } from '@/lib/compare';
import { formatRangeCompact } from '@/lib/flags';
import { flagLabel, hasOfflinePack, localExplanation, localQuestions, localSummary, nativeName, uiFor } from '@/lib/i18n';
import { SAMPLES } from '@/lib/samples';
import type { LabReport, LabRow, Language, TranslatedReport } from '@/lib/types';
import { buildShareText, whatsappUrl } from '@/lib/share';
import { DoctorSheet } from './DoctorSheet';
import { FamilyHandout } from './FamilyHandout';

const LANG_LABEL: Record<Language, string> = { en: 'English', te: 'Telugu · తెలుగు', hi: 'Hindi · हिन्दी', es: 'Spanish · Español', ta: 'Tamil · தமிழ்', kn: 'Kannada · ಕನ್ನಡ', ml: 'Malayalam · മലയാളം', bn: 'Bengali · বাংলা', mr: 'Marathi · मराठी' };
const VOICE_LANG: Record<Language, string> = { en: 'en-US', te: 'te-IN', hi: 'hi-IN', es: 'es-ES', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', mr: 'mr-IN' };
const TOUR_STEPS = 5;
const TOUR_STEP_MS = 3000;

interface MuseStatus { configured: boolean; disabled: boolean; model: string }
interface EvalResults { passed: number; total: number; generated_at: string }

const rangeText = (r: LabRow, none: string) => formatRangeCompact(r.ref_low, r.ref_high, r.unit, none);

export default function Home() {
  const [report, setReport] = useState<LabReport | null>(null);
  const [previous, setPrevious] = useState<LabReport | null>(null);
  const [samples, setSamples] = useState<LabReport[]>(SAMPLES);
  const [language, setLanguage] = useState<Language>('en');
  const [large, setLarge] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showDoctor, setShowDoctor] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [listening, setListening] = useState(false);
  const [listenIdx, setListenIdx] = useState<number | null>(null);
  const [showHandout, setShowHandout] = useState(false);
  const [guiding, setGuiding] = useState(false);
  const [guideIdx, setGuideIdx] = useState<number | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const listenToken = useRef(0);
  const [drag, setDrag] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recheckDate, setRecheckDate] = useState('');
  const [muse, setMuse] = useState<MuseStatus | null>(null);
  const [evalResults, setEvalResults] = useState<EvalResults | null>(null);
  const [translated, setTranslated] = useState<TranslatedReport | null>(null);
  const [translating, setTranslating] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const museOn = muse?.configured === true;
  const ui = uiFor(language);

  // --- one-time setup -------------------------------------------------------------------
  useEffect(() => {
    fetch('/api/samples').then((r) => r.json()).then((d) => { if (Array.isArray(d) && d.length > 0) setSamples(d); }).catch(() => {});
    fetch('/api/status').then((r) => r.json()).then((d) => setMuse({ configured: Boolean(d.muse_configured), disabled: Boolean(d.muse_disabled), model: String(d.muse_model ?? '') })).catch(() => setMuse(null));
    fetch('/eval-results.json').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && typeof d.passed === 'number') setEvalResults(d); }).catch(() => {});
    return () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('large', large);
    document.body.classList.toggle('contrast', contrast);
  }, [large, contrast]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);

  // --- Muse translation: cancelled on change, never shows a previous language's text ---------
  useEffect(() => {
    setTranslated(null);
    setTranslating(false);
    if (!report || language === 'en' || !museOn) return;
    const ctrl = new AbortController();
    setTranslating(true);
    const explanations = Object.fromEntries(report.rows.map((r) => [r.test_name, r.plain_english]));
    fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ summary: report.summary, questions: report.questions, explanations, language }) })
      .then((r) => r.json())
      .then((d) => { if (!ctrl.signal.aborted && d && !d.error && Array.isArray(d.summary)) setTranslated(d as TranslatedReport); })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setTranslating(false); });
    return () => ctrl.abort();
  }, [language, report, museOn]);

  // --- guided tour: sample -> plain table -> Telugu -> doctor sheet ---------------------------
  useEffect(() => {
    if (tourStep === null) return;
    if (tourStep >= TOUR_STEPS) { setTourStep(null); return; }
    const t = setTimeout(() => {
      if (tourStep === 0) { setReport(samples.find((s) => s.id === 'mixed-abnormal') ?? samples[0] ?? null); setShowDoctor(false); setError(''); }
      if (tourStep === 1) setExpanded('Hemoglobin');
      if (tourStep === 2) { setExpanded(null); setLanguage('te'); }
      if (tourStep === 3) setShowDoctor(true);
      if (tourStep === 4) { setShowDoctor(false); setLanguage('en'); }
      setTourStep(tourStep + 1);
    }, tourStep === 0 ? 400 : TOUR_STEP_MS);
    return () => clearTimeout(t);
  }, [tourStep, samples]);

  // --- text shown to the user: Muse translation if valid, else built-in pack, else English ---------
  const display = useMemo(() => {
    if (!report) return { summary: [] as string[], questions: [] as string[], explain: (_r: LabRow) => '' };
    if (language === 'en') return { summary: report.summary, questions: report.questions, explain: (r: LabRow) => r.plain_english };
    const localSum = localSummary(report.rows, language);
    const localQs = localQuestions(report.rows, language);
    const pick = (fromMuse: (string | null)[] | undefined, local: string[] | null, english: string[]) =>
      english.map((en, i) => fromMuse?.[i] ?? local?.[i] ?? en);
    return {
      summary: pick(translated?.summary, localSum, report.summary),
      questions: pick(translated?.questions, localQs, report.questions),
      explain: (r: LabRow) => translated?.explanations[r.test_name] ?? localExplanation(r, language) ?? r.plain_english,
    };
  }, [report, language, translated]);

  const translationNotice = report && language !== 'en' && !hasOfflinePack(language) && !translated
    ? (museOn ? (translating ? 'Translating with Muse Spark…' : 'Muse could not translate this right now, so English is shown.') : `${LANG_LABEL[language].split(' ·')[0]} needs Muse Spark, which is not connected. English is shown. Telugu, Hindi and Spanish work without it.`)
    : '';

  // --- actions ---------------------------------------------------------------------------------
  async function onUpload(file: File | undefined) {
    if (!file) return;
    setError(''); setLoading(true); setShowDoctor(false); setTourStep(null);
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch('/api/analyze', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not read that file.');
      setReport(data as LabReport);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read that file.'); }
    finally { setLoading(false); if (fileInput.current) fileInput.current.value = ''; }
  }

  async function loadSample(url: string, name: string, type: string) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('missing');
      onUpload(new File([await r.blob()], name, { type }));
    } catch { setError(`Could not load ${name}.`); }
  }

  async function runMuseOnSample() {
    if (!report?.is_synthetic) return;
    setEnhancing(true); setError('');
    try {
      const res = await fetch('/api/enhance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: report.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Muse did not respond.');
      setReport(data as LabReport);
    } catch (e) { setError(e instanceof Error ? e.message : 'Muse did not respond.'); }
    finally { setEnhancing(false); }
  }

  /** Browsers often load their voice list a moment late; wait briefly instead of guessing. */
  function voicesReady(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      let settled = false;
      const done = () => { if (settled) return; settled = true; synth.removeEventListener('voiceschanged', done); resolve(synth.getVoices()); };
      synth.addEventListener('voiceschanged', done);
      setTimeout(done, 800);
    });
  }

  /** Read one line at a time and report which line is being spoken, so a parent can follow on screen. */
  async function speakItems(items: string[], lang: string, onIndex: (i: number | null) => void, onDone: () => void) {
    if (!('speechSynthesis' in window)) { setError('Listening is not supported in this browser.'); onDone(); return; }
    const token = ++listenToken.current;
    window.speechSynthesis.cancel();
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) { voices = await voicesReady(); if (token !== listenToken.current) return; }
    if (voices.length > 0 && !voices.some((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang.slice(0, 2).toLowerCase()))) {
      setError(`This device has no ${LANG_LABEL[language].split(' ·')[0]} voice installed, so listening may be silent. Install one in your system speech settings, or use the large-print handout.`);
    }
    const finish = () => { if (token === listenToken.current) { onIndex(null); onDone(); } };
    const speakAt = (i: number) => {
      if (token !== listenToken.current) return;
      if (i >= items.length) { finish(); return; }
      const utter = new SpeechSynthesisUtterance(items[i]);
      utter.lang = lang;
      utter.onstart = () => { if (token === listenToken.current) onIndex(i); };
      utter.onend = () => speakAt(i + 1);
      utter.onerror = finish;
      window.speechSynthesis.speak(utter);
    };
    speakAt(0);
  }

  function listen() {
    if (!report) return;
    setListening(true);
    void speakItems([...display.summary, ...display.questions], VOICE_LANG[language], setListenIdx, () => setListening(false));
  }
  // The how-to-use guide is only translated for languages with a built-in pack; otherwise it is English, so speak it with an English voice.
  function guide() {
    setGuiding(true);
    void speakItems(ui.guideSteps, hasOfflinePack(language) ? VOICE_LANG[language] : VOICE_LANG.en, setGuideIdx, () => setGuiding(false));
  }
  function stopListen() {
    listenToken.current++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setListening(false); setListenIdx(null); setGuiding(false); setGuideIdx(null);
  }

  // Opening or leaving a report ends any speech in progress (the guide, or Listen on the previous report).
  useEffect(() => { stopListen(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  /** Leave the current report but keep a saved "previous" report so two reports can be compared. */
  function startNew() { setReport(null); setShowDoctor(false); setShowHandout(false); setExpanded(null); setShowCompare(false); setShowOriginal(false); stopListen(); }
  function saveAndOpenAnother() { setPrevious(report); startNew(); }
  function clearAll() { startNew(); setPrevious(null); setError(''); setRecheckDate(''); }

  const shareText = report ? buildShareText({ title: report.title, summary: display.summary, questions: display.questions, questionsHeading: ui.questionsToAsk, disclaimer: ui.infoOnly, synthetic: report.is_synthetic }) : '';
  async function shareSummary() {
    if (!report) return;
    const copy = async () => { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    try { if (navigator.share) await navigator.share({ title: 'Lab Report Translator', text: shareText }); else await copy(); }
    catch { try { await copy(); } catch { /* clipboard unavailable */ } }
  }

  const comparison = report && previous ? compareReports(previous.rows, report.rows) : [];
  const flagged = report?.rows.filter((r) => r.flag === 'High' || r.flag === 'Low' || r.flag === 'Unknown') ?? [];
  const normalCount = report?.rows.filter((r) => r.flag === 'Normal').length ?? 0;
  const unknownCount = report?.rows.filter((r) => r.flag === 'Unknown').length ?? 0;
  const reviewCount = report?.rows.filter((r) => r.confidence === 'low').length ?? 0;
  const fromPhoto = report?.muse_features?.includes('photo reading') ?? false;

  const musePill = !muse ? '' : muse.configured ? `Muse Spark connected · ${muse.model}` : muse.disabled ? 'Offline mode (Muse disabled)' : 'Offline mode: no Muse key set';

  return (
    <>
      <header className="topbar no-print">
        <div className="topbar-inner">
          <div className="logo"><span className="logo-mark" aria-hidden="true">✚</span><span>Lab Report Translator<small>Plain language for every family</small></span></div>
          <div className="row" style={{ marginTop: 0 }}>
            <label>{ui.languageLabel} <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>{Object.entries(LANG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <button onClick={() => setLarge(!large)} aria-pressed={large}>{large ? ui.normalText : ui.largeText}</button>
            <button onClick={() => setContrast(!contrast)} aria-pressed={contrast}>{contrast ? ui.normalContrast : ui.highContrast}</button>
          </div>
        </div>
      </header>

      <main>
        {!report && (
          <>
            <section className="hero simple no-print">
              <h1>{ui.heroTitleA} <em>{ui.heroTitleB}</em></h1>
              <p className="lede">{ui.lede}</p>
              <p className="infoline">✓ {ui.infoOnly}</p>
            </section>

            <section className="card hero-card no-print fade">
              <h2>{ui.translateHeading}</h2>
              <div className="guide">
                <button className="big" onClick={() => { setGuideOpen(true); if (guiding) stopListen(); else guide(); }} aria-pressed={guiding}>
                  {guiding ? `⏹ ${ui.stopListenBtn}` : `🔊 ${ui.guideBtn}`}
                </button>
                {guideOpen && (
                  <ol className="guide-steps" aria-label={ui.guideTitle} lang={hasOfflinePack(language) ? language : 'en'}>
                    {ui.guideSteps.map((s, i) => <li key={i} className={guideIdx === i ? 'speaking' : ''}>{s}</li>)}
                  </ol>
                )}
              </div>
              <div className={`dropzone ${drag ? 'drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); onUpload(e.dataTransfer.files?.[0]); }}>
                <button className="primary big" onClick={() => fileInput.current?.click()}>📄 {ui.chooseFileBtn}</button>
                <p className="muted">{ui.dropTitle}</p>
                <input ref={fileInput} type="file" hidden accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/*" aria-label="Upload a lab PDF or photo" onChange={(e) => onUpload(e.target.files?.[0])} />
              </div>
              <div className="row">
                <button className="big" onClick={() => loadSample('/sample-report.pdf', 'sample-report.pdf', 'application/pdf')}>{ui.trySamplePdf}</button>
              </div>
              {loading && <div role="status"><p>Reading your report{museOn ? ' with Muse Spark. This can take up to a minute' : ''}…</p><div className="progress"><i /></div></div>}
              {error && <div className="error" role="alert">{error}</div>}
              <p className="muted small">Privacy: this app stores nothing.</p>
            </section>

            <details className="card more no-print">
              <summary>{ui.moreBtn}</summary>
              <div className="grid">
                {samples.map((s) => (
                  <button key={s.id} className="sample" onClick={() => { setReport(s); setShowDoctor(false); setError(''); }}>
                    <div className="dots">{s.rows.map((r) => <span key={r.test_name} className={`dot ${r.flag}`} title={`${r.test_name}: ${r.flag}`} />)}</div>
                    <strong>{s.title}</strong>
                    <span>SYNTHETIC • {s.rows.length} tests • Tap to translate →</span>
                  </button>
                ))}
              </div>
              <div className="row">
                <button onClick={() => loadSample('/sample-photo.png', 'sample-photo.png', 'image/png')} disabled={!museOn} title={museOn ? 'Reads the photo with Muse Spark vision' : 'Needs a Muse key'}>🖼 Try the sample photo (Muse vision)</button>
                <button onClick={() => setTourStep(0)} disabled={tourStep !== null}>{tourStep !== null ? `▶ Tour: step ${Math.min(tourStep + 1, TOUR_STEPS)} of ${TOUR_STEPS}` : '▶ Quick tour (about 15 seconds)'}</button>
                {tourStep !== null && <button onClick={() => setTourStep(null)}>⏹ Stop tour</button>}
                <a href="/sample-report.pdf" download className="linkbtn">⬇ Download the sample PDF</a>
              </div>
              {previous && <p className="badge">📌 Saved for comparison: {previous.title}. Open another report to compare.</p>}
              {musePill && <p className="muted">✦ {musePill}{!muse?.configured && '. Samples, PDFs and Telugu/Hindi/Spanish still work; photos and other languages need Muse.'}</p>}
              {evalResults && <p className="proof" title={`Generated ${evalResults.generated_at} by npm test`}>✓ {evalResults.passed}/{evalResults.total} automated checks passing on the real parser, flag engine and AI-output filters (<code>npm test</code>)</p>}
              <p className="muted small">Privacy: this app stores nothing. With a Muse key set, the report text (patient-name, date-of-birth and ID lines removed) or your photo is sent to Meta&apos;s Muse API to be explained; see Meta&apos;s terms. Without a key, nothing leaves this server.</p>
              <h2 style={{ marginTop: 22 }}>AI explains. Code decides.</h2>
              <div className="split">
                <div>
                  <h3>Code decides</h3>
                  <ul>
                    <li>Every value, unit and printed range is copied from the report.</li>
                    <li>High / Low / Normal comes from comparing the value to the printed range. <code>lib/flags.ts</code> is the only place a flag is made.</li>
                    <li>If no range is printed the flag is <strong>Unknown</strong>. We never guess one.</li>
                    <li>Every row is re-checked against the document text; failures are marked Needs Review.</li>
                  </ul>
                </div>
                <div>
                  <h3>Muse Spark explains</h3>
                  <ul>
                    <li>Reads photos of reports (vision).</li>
                    <li>Translates summaries, questions and explanations into 9 languages.</li>
                    <li>Rewrites the explanations, 3-line summary and doctor questions in natural language.</li>
                    <li>Runs a second-pass check of the extracted rows. It can only <em>downgrade</em> confidence.</li>
                    <li>Anything it writes must name the right test and value, match the code&apos;s flag, add no number and no diagnosis, or it is discarded and the built-in text is shown.</li>
                  </ul>
                </div>
              </div>
            </details>
          </>
        )}

        {report && !showDoctor && !showHandout && (
          <section className="card fade" aria-labelledby="report-title">
            <div className="no-print"><button onClick={startNew}>← {ui.newReportBtn}</button></div>
            {error && <div className="error no-print" role="alert">{error}</div>}
            <h2 id="report-title" style={{ marginTop: 18 }}>{report.title} {report.is_synthetic && <span className="pill">SYNTHETIC</span>}</h2>
            <div className="actions-primary no-print">
              <button className="primary big" onClick={listening ? stopListen : listen}>{listening ? `⏹ ${ui.stopListenBtn}` : `🔊 ${ui.listenBtn}`}</button>
              <button className="big" onClick={() => setShowDoctor(true)}>🖨 {ui.doctorSheetBtn}</button>
              <button className="big" onClick={() => setShowHandout(true)}>🔠 {ui.handoutBtn}</button>
              <a className="linkbtn big" href={whatsappUrl(shareText)} target="_blank" rel="noopener noreferrer">💬 {ui.whatsappBtn}</a>
            </div>
            {translationNotice && <p className="muted" role="status">{translationNotice}</p>}
            {!report.verification_passed && <div className="warn">{report.verification_note}</div>}
            {reviewCount > 0 && <div className="warn">{reviewCount} test(s) below are marked <strong>Needs review</strong>. Please check them against your original report.</div>}
            {report.skipped_lines && report.skipped_lines.length > 0 && (
              <details className="warn"><summary>{report.skipped_lines.length} line(s) not read. Check them in your original</summary><ul>{report.skipped_lines.map((l, i) => <li key={i}><code>{l}</code></li>)}</ul></details>
            )}
            <h3>{ui.summaryHeading}</h3>
            <ul className="bigtext">{display.summary.map((s, i) => <li key={i} className={listenIdx === i ? 'speaking' : ''}>{s}</li>)}</ul>
            <h3>{ui.resultsHeading}</h3>
            <table>
              <thead><tr><th>{ui.testCol}</th><th>{ui.valueCol}</th><th>{ui.rangeCol}</th><th>{ui.flagCol}</th><th>{ui.meaningCol}</th></tr></thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.test_name}>
                    <td data-label={ui.testCol}>
                      <button onClick={() => setExpanded(expanded === r.test_name ? null : r.test_name)} aria-expanded={expanded === r.test_name}>{r.test_name} ▾</button>
                      {r.confidence === 'low' && <div><span className="pill review" title={r.review_reason}>Needs review</span></div>}
                      {expanded === r.test_name && (
                        <div className="detail">
                          <strong>{fromPhoto ? 'Quoted from your photo:' : 'From your report:'}</strong> <code>{r.source_text}</code>
                          {r.flag_source === 'report_marker' && <div>The {r.flag} flag was copied from the report&apos;s own marker; no range is printed.</div>}
                          {r.review_reason && <div>{r.review_reason}</div>}
                        </div>
                      )}
                    </td>
                    <td data-label={ui.valueCol}><span className="value">{r.value} {r.unit}</span></td>
                    <td data-label={ui.rangeCol}>{rangeText(r, 'Range not on report')}</td>
                    <td data-label={ui.flagCol}><span className={`flag ${r.flag}`}>{flagLabel(language, r.flag)}</span></td>
                    <td data-label={ui.meaningCol}>{display.explain(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>{ui.questionsToAsk}</h3>
            <ol className="bigtext">{display.questions.map((q, i) => <li key={i} className={listenIdx === display.summary.length + i ? 'speaking' : ''}>{q}</li>)}</ol>
            <div className="warn"><strong>{ui.notMeanTitle}</strong> {ui.notMeanBody}</div>

            {showCompare && comparison.length > 0 && (
              <div>
                <h3>Compare: {previous?.title} vs this report</h3>
                <p className="muted">Numbers only. A change in value is not, by itself, a diagnosis.</p>
                <table>
                  <thead><tr><th>Test</th><th>Previous</th><th>Now</th><th>Change</th></tr></thead>
                  <tbody>{comparison.map((c) => <tr key={c.test_name}><td data-label="Test">{c.test_name}</td><td data-label="Previous">{c.old_value === null ? '—' : `${c.old_value} ${c.old_unit} (${c.old_flag})`}</td><td data-label="Now">{c.new_value === null ? '—' : `${c.new_value} ${c.new_unit} (${c.new_flag})`}</td><td data-label="Change">{c.change_text} {c.flag_change}</td></tr>)}</tbody>
                </table>
              </div>
            )}

            <details className="more no-print">
              <summary>{ui.moreBtn}</summary>
              <div className="actions-secondary">
                <button className="btn-ghost" onClick={shareSummary}>{copied ? `✓ ${ui.copiedBtn}` : `📤 ${ui.shareBtn}`}</button>
                <button className="btn-ghost" onClick={saveAndOpenAnother}>📌 Save and open another to compare</button>
                {previous && previous !== report && <button className="btn-ghost" onClick={() => setShowCompare(!showCompare)}>{showCompare ? 'Hide comparison' : `⇄ Compare with ${previous.title}`}</button>}
                {report.is_synthetic && museOn && !report.muse_used && <button className="btn-ghost" onClick={runMuseOnSample} disabled={enhancing}>{enhancing ? '✦ Muse is writing…' : '✦ Run Muse Spark on this sample'}</button>}
                <button className="btn-ghost" onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? 'Hide original lines' : 'Show original lines'}</button>
                <button className="btn-ghost" onClick={clearAll}>{ui.clearBtn}</button>
              </div>
              {showOriginal && <div className="detail" style={{ marginTop: 10 }}>{report.rows.map((r) => <div key={r.test_name}><code>{r.source_text}</code></div>)}</div>}
              <div className="row"><label>{ui.recheck} <input type="date" value={recheckDate} onChange={(e) => setRecheckDate(e.target.value)} /></label></div>
              <div className="pills">
                {report.muse_used && report.muse_features && report.muse_features.length > 0 && <span className="pill">✦ Muse Spark: {report.muse_features.join(' · ')}</span>}
                {language !== 'en' && translated && <span className="pill">✦ Translated with Muse Spark</span>}
                {language !== 'en' && !translated && hasOfflinePack(language) && <span className="pill">Built-in {nativeName(language)} translation{translating ? ' · Muse is refining…' : ''}</span>}
              </div>
              {report.verification_passed && <div className="badge">✓ {report.verification_note}</div>}
              <p className="muted">{report.source_note}</p>
            </details>
          </section>
        )}

        {report && showHandout && !showDoctor && (
          <FamilyHandout report={report} language={language} summary={display.summary} questions={display.questions} explain={display.explain} onBack={() => setShowHandout(false)} />
        )}
        {report && showDoctor && (
          <DoctorSheet report={report} language={language} summary={display.summary} questions={display.questions} flagged={flagged} recheckDate={recheckDate} onBack={() => setShowDoctor(false)} onClear={clearAll} />
        )}

        <footer className="no-print"><p>This app explains a lab report. It does not diagnose, treat, or replace medical advice. Always ask your doctor about your results. Open source (MIT).</p></footer>
      </main>
    </>
  );
}
