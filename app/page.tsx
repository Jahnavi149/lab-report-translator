'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatRangeCompact, formatValue, questionsFor, summaryFor } from '@/lib/flags';
import { flagLabel, uiFor } from '@/lib/i18n';
import { appText, EN_APP, fill, localizeServerText } from '@/lib/i18n-app';
import type { LabReport, LabRow, Language, TranslatedReport } from '@/lib/types';
import { cropImage, isImageFile, normalizeImage, type CropEdges } from '@/lib/clientImage';
import { buildShareText, whatsappUrl } from '@/lib/share';
import { AiSees } from './AiSees';
import { DoctorSheet } from './DoctorSheet';
import { FamilyHandout } from './FamilyHandout';
import { ImageCitationViewer } from './ImageCitationViewer';
import { PdfCitationViewer } from './PdfCitationViewer';
import { PhotoCropDialog } from './PhotoCropDialog';
import { ReviewRowDialog } from './ReviewRowDialog';
import { useVoiceAsk, VoiceButton, VoicePanel } from './VoiceAsk';
import type { VoiceAction } from '@/lib/voice';

const LANG_LABEL: Record<Language, string> = { en: 'English', te: 'Telugu · తెలుగు', hi: 'Hindi · हिन्दी', es: 'Spanish · Español', ta: 'Tamil · தமிழ்', kn: 'Kannada · ಕನ್ನಡ', bn: 'Bengali · বাংলা', mr: 'Marathi · मराठी', tl: 'Tagalog', ms: 'Malay · Bahasa Melayu', ar: 'Arabic · العربية', fr: 'French · Français', de: 'German · Deutsch', pt: 'Portuguese · Português', id: 'Indonesian · Bahasa Indonesia' };
const VOICE_LANG: Record<Language, string> = { en: 'en-US', te: 'te-IN', hi: 'hi-IN', es: 'es-ES', ta: 'ta-IN', kn: 'kn-IN', bn: 'bn-IN', mr: 'mr-IN', tl: 'fil-PH', ms: 'ms-MY', ar: 'ar-SA', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', id: 'id-ID' };

const rangeText = (r: LabRow, none: string) => formatRangeCompact(r.ref_low, r.ref_high, r.unit, none);

export default function Home() {
  const [report, setReport] = useState<LabReport | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [large, setLarge] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showDoctor, setShowDoctor] = useState(false);
  const [testDate, setTestDate] = useState('');
  const [showHandout, setShowHandout] = useState(false);
  const [listening, setListening] = useState(false);
  const [listenIdx, setListenIdx] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const [copied, setCopied] = useState(false);
  const [translated, setTranslated] = useState<TranslatedReport | null>(null);
  const [translating, setTranslating] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [sourceAnchor, setSourceAnchor] = useState<LabRow['source_anchor'] | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sourceBox, setSourceBox] = useState<LabRow['source_box'] | null>(null);
  const [sourceQuote, setSourceQuote] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [reviewingTest, setReviewingTest] = useState<string | null>(null);
  const listenToken = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const ui = uiFor(language);
  const t = appText(language);
  // Server and page messages are kept in English in state and shown in the chosen language, so a language switch updates them.
  const L = (text: string) => localizeServerText(text, language);

  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('large', large);
    document.body.classList.toggle('contrast', contrast);
  }, [large, contrast]);
  useEffect(() => {
    document.documentElement.lang = language;
    // Arabic reads right to left; every other language here reads left to right.
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  // --- Muse translation: cancelled on change, never shows a previous language's text ---------
  useEffect(() => {
    setTranslated(null);
    setTranslating(false);
    if (!report || language === 'en') return;
    const ctrl = new AbortController();
    setTranslating(true);
    const explanations = Object.fromEntries(report.rows.map((r) => [r.test_name, r.plain_english]));
    fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ summary: report.summary, questions: report.questions, explanations, language }) })
      .then((r) => r.json())
      .then((d) => { if (!ctrl.signal.aborted && d && !d.error && Array.isArray(d.summary)) setTranslated(d as TranslatedReport); })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setTranslating(false); });
    return () => ctrl.abort();
  }, [language, report]);

  // Text shown to the user: the Muse translation, item by item. Anything that failed validation stays English.
  const display = useMemo(() => {
    if (!report) return { summary: [] as string[], questions: [] as string[], explain: (_r: LabRow) => '' };
    return {
      summary: report.summary.map((en, i) => translated?.summary[i] ?? en),
      questions: report.questions.map((en, i) => translated?.questions[i] ?? en),
      explain: (r: LabRow) => translated?.explanations[r.test_name] ?? r.plain_english,
    };
  }, [report, translated]);

  const translationNotice = report && language !== 'en' && !translated ? (translating ? t('translating') : t('translationUnavailable')) : '';
  // Text is spoken in the chosen language only once it has actually been translated.
  const spokenLang = language !== 'en' && !translated ? VOICE_LANG.en : VOICE_LANG[language];

  // --- actions ---------------------------------------------------------------------------------
  // A PDF is read straight away. A photo first goes through the crop step, so the header with the patient's name
  // is cut off here in the browser and never uploaded.
  async function onUpload(file: File | undefined) {
    if (!file) return;
    setError('');
    if (!isImageFile(file)) { await analyze(file, file); return; }
    setLoading(true);
    try { setPendingPhoto(await normalizeImage(file)); }
    finally { setLoading(false); if (fileInput.current) fileInput.current.value = ''; }
  }

  async function confirmCrop(edges: CropEdges) {
    const photo = pendingPhoto;
    setPendingPhoto(null);
    if (!photo) return;
    setLoading(true);
    try { await analyze(await cropImage(photo, edges), photo); }
    catch { setError(EN_APP.cropError); setLoading(false); }
  }

  async function analyze(upload: File, file: File) {
    setError(''); setLoading(true); setShowDoctor(false);
    try {
      const form = new FormData(); form.append('file', upload);
      const res = await fetch('/api/analyze', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? EN_APP.readError);
      setReport(data as LabReport);
      setTestDate('');
      setPdfFile(data.source_kind === 'pdf' ? file : null);
      setSourceAnchor(null);
      setImageFile(data.source_kind === 'photo' ? upload : null);
      setSourceBox(null);
    } catch (e) { setError(e instanceof Error ? e.message : EN_APP.readError); }
    finally { setLoading(false); if (fileInput.current) fileInput.current.value = ''; }
  }

  async function loadSample() {
    try {
      const r = await fetch('/sample-report.pdf');
      if (!r.ok) throw new Error('missing');
      onUpload(new File([await r.blob()], 'sample-report.pdf', { type: 'application/pdf' }));
    } catch { setError(EN_APP.sampleError); }
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
    if (!('speechSynthesis' in window)) { setError(EN_APP.listenUnsupported); onDone(); return; }
    const token = ++listenToken.current;
    window.speechSynthesis.cancel();
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) { voices = await voicesReady(); if (token !== listenToken.current) return; }
    if (voices.length > 0 && !voices.some((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang.slice(0, 2).toLowerCase()))) {
      setError(fill(EN_APP.noVoice, { language: LANG_LABEL[language].split(' · ').pop() ?? '' }));
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
    void speakItems([...display.summary, ...display.questions], spokenLang, setListenIdx, () => setListening(false));
  }
  function stopListen() {
    listenToken.current++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setListening(false); setListenIdx(null);
  }

  // Voice questions: the mic reuses speakItems (so voice choice per language is the same as Listen) and the page's own state.
  function speakSummary(onDone: () => void) {
    setListening(true);
    void speakItems(display.summary, spokenLang, setListenIdx, () => { setListening(false); onDone(); });
  }
  function performVoiceAction(a: VoiceAction) {
    if (a.type === 'language') setLanguage(a.language);
    else if (a.type === 'navigate') { setShowDoctor(a.target === 'doctor-sheet'); setShowHandout(a.target === 'handout'); }
  }
  const voice = useVoiceAsk({ report, language, ui, voiceLang: VOICE_LANG[language], speak: speakItems, stopSpeaking: stopListen, speakSummary, displaySummary: display.summary, perform: performVoiceAction });

  // Opening or leaving a report ends any speech in progress.
  useEffect(() => { stopListen(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  function startNew() { setReport(null); setTestDate(''); setPdfFile(null); setSourceAnchor(null); setImageFile(null); setSourceBox(null); setReviewingTest(null); setShowDoctor(false); setShowHandout(false); setExpanded(null); stopListen(); }
  function clearAll() { startNew(); setError(''); }

  const shareText = report ? buildShareText({ title: report.title, summary: display.summary, questions: display.questions, questionsHeading: ui.questionsToAsk, disclaimer: ui.infoOnly, synthetic: report.is_synthetic }) : '';
  async function shareSummary() {
    if (!report) return;
    const copy = async () => { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    try { if (navigator.share) await navigator.share({ title: 'Lab Report Translator', text: shareText }); else await copy(); }
    catch { try { await copy(); } catch { /* clipboard unavailable */ } }
  }

  const flagged = report?.rows.filter((r) => r.flag === 'High' || r.flag === 'Low' || r.flag === 'Unknown') ?? [];
  const reviewCount = report?.rows.filter((r) => r.confidence === 'low').length ?? 0;
  const reviewingRow = report?.rows.find((r) => r.test_name === reviewingTest && r.confidence === 'low') ?? null;
  const fromPhoto = report?.muse_features?.includes('photo reading') ?? false;
  function citeRow(row: LabRow) {
    if (pdfFile && row.source_anchor) setSourceAnchor(row.source_anchor);
    if (imageFile && row.source_box) { setSourceBox(row.source_box); setSourceQuote(row.source_text); }
  }
  // The Source column appears for a PDF, or for a photo once at least one line could be located in it.
  const showSource = Boolean(pdfFile) || Boolean(imageFile && report?.rows.some((r) => r.source_box));
  const where = pdfFile ? t('inPdf') : t('inPhoto');

  function finishRowReview(testName: string, decision: 'approve' | 'reject') {
    setReport((current) => {
      if (!current) return current;
      const rows = decision === 'approve'
        ? current.rows.map((row) => row.test_name === testName ? { ...row, confidence: 'high' as const, review_reason: undefined } : row)
        : current.rows.filter((row) => row.test_name !== testName);
      const remaining = rows.filter((row) => row.confidence === 'low').length;
      return {
        ...current,
        rows,
        ...(decision === 'reject' ? { summary: summaryFor(rows), questions: questionsFor(rows) } : {}),
        verification_passed: remaining === 0,
        verification_note: remaining === 0
          ? EN_APP.allReviewed
          : fill(EN_APP.stillNeedReview, { n: remaining }),
      };
    });
    setReviewingTest(null);
  }

  return (
    <>
      <header className="topbar no-print">
        <div className="topbar-inner">
          <div className="logo"><span className="logo-mark" aria-hidden="true">✚</span><span>Lab Report Translator<small>{t('tagline')}</small></span></div>
          <div className="row" style={{ marginTop: 0 }}>
            <label>{ui.languageLabel} <select aria-label={t('languageAria')} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>{Object.entries(LANG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
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
              <div className={`dropzone ${drag ? 'drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); onUpload(e.dataTransfer.files?.[0]); }}>
                <button className="primary big" onClick={() => fileInput.current?.click()}>📄 {ui.chooseFileBtn}</button>
                <p className="muted">{ui.dropTitle}</p>
                <input ref={fileInput} type="file" hidden accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/*" aria-label={t('uploadAria')} onChange={(e) => onUpload(e.target.files?.[0])} />
              </div>
              <div className="row">
                <button className="big" onClick={loadSample}>{ui.trySamplePdf}</button>
              </div>
              {loading && <div role="status"><p>{t('reading')}</p><div className="progress"><i /></div></div>}
              {error && <div className="error" role="alert">{L(error)}</div>}
              <p className="muted small">{ui.privacyNote}</p>
            </section>
          </>
        )}

        {report && !showDoctor && !showHandout && (
          <div>
          <section className="card fade" aria-labelledby="report-title">
            <div className="no-print"><button onClick={startNew}>← {ui.newReportBtn}</button></div>
            {error && <div className="error no-print" role="alert">{L(error)}</div>}
            <h2 id="report-title" style={{ marginTop: 18 }}>{report.title} {report.is_synthetic && <span className="pill">{t('synthetic')}</span>}</h2>
            <div className="actions-primary no-print">
              <button className="primary big" onClick={listening ? stopListen : listen}>{listening ? `⏹ ${ui.stopListenBtn}` : `🔊 ${ui.listenBtn}`}</button>
              <VoiceButton v={voice} ui={ui} />
              <button className="big" onClick={() => setShowDoctor(true)}>🖨 {ui.doctorSheetBtn}</button>
              <button className="big" onClick={() => setShowHandout(true)}>🔠 {ui.handoutBtn}</button>
              <a className="linkbtn big" href={whatsappUrl(shareText)} target="_blank" rel="noopener noreferrer">💬 {ui.whatsappBtn}</a>
            </div>
            <VoicePanel v={voice} ui={ui} />
            {report.ai_input && <AiSees input={report.ai_input} voice={voice.exchanges} language={language} />}
            {translationNotice && <p className="muted" role="status">{translationNotice}</p>}
            {!report.verification_passed && <div className="warn">{L(report.verification_note)}</div>}
            {reviewCount > 0 && <div className="warn">{t('reviewBanner', { n: reviewCount })}</div>}
            {report.skipped_lines && report.skipped_lines.length > 0 && (
              <details className="warn"><summary>{t('linesNotRead', { n: report.skipped_lines.length })}</summary><ul>{report.skipped_lines.map((l, i) => <li key={i}><code>{l}</code></li>)}</ul></details>
            )}
            <h3>{ui.summaryHeading}</h3>
            <ul className="bigtext">{display.summary.map((s, i) => <li key={i} dir="auto" className={listenIdx === i ? 'speaking' : ''}>{s}</li>)}</ul>
            <h3>{ui.resultsHeading}</h3>
            <table>
              <thead><tr><th>{ui.testCol}</th><th>{ui.valueCol}</th><th>{ui.rangeCol}</th><th>{ui.flagCol}</th><th>{ui.meaningCol}</th>{showSource && <th>{t('sourceCol')}</th>}</tr></thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.test_name}>
                    <td data-label={ui.testCol}>
                      <button onClick={() => setExpanded(expanded === r.test_name ? null : r.test_name)} aria-expanded={expanded === r.test_name}>{r.test_name} ▾</button>
                      {r.confidence === 'low' && <div><button type="button" className="pill review review-chip" title={r.review_reason ? L(r.review_reason) : undefined} onClick={() => setReviewingTest(r.test_name)}>{t('needsReviewChip')}</button></div>}
                      {expanded === r.test_name && (
                        <div className="detail">
                          <strong>{fromPhoto ? t('quotedFromPhoto') : t('fromYourReport')}</strong>{' '}
                          <code>{r.source_text}</code>
                          {r.flag_source === 'report_marker' && <div>{t('flagFromMarker', { flag: flagLabel(language, r.flag) })}</div>}
                          {r.review_reason && <div>{L(r.review_reason)}</div>}
                        </div>
                      )}
                    </td>
                    <td data-label={ui.valueCol}><span className="value">{formatValue(r.value, r.unit)}</span></td>
                    <td data-label={ui.rangeCol}>{rangeText(r, t('rangeNotOnReport'))}</td>
                    <td data-label={ui.flagCol}><span className={`flag ${r.flag}`}>{flagLabel(language, r.flag)}</span></td>
                    <td data-label={ui.meaningCol} dir="auto">{display.explain(r)}</td>
                    {showSource && <td data-label={t('sourceCol')}>{(pdfFile ? r.source_anchor : r.source_box)
                      ? <button type="button" className="pdf-citation-button" onClick={() => citeRow(r)} title={t('viewTitle', { where })} aria-label={t('viewAria', { test: r.test_name, where })}>🔎 <span>{t('viewBtn')}</span></button>
                      : <span aria-label={t('noLocation', { where })}>—</span>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>{ui.questionsToAsk}</h3>
            <ol className="bigtext">{display.questions.map((q, i) => <li key={i} dir="auto" className={listenIdx === display.summary.length + i ? 'speaking' : ''}>{q}</li>)}</ol>
            <div className="warn"><strong>{ui.notMeanTitle}</strong> {ui.notMeanBody}</div>
            <div className="actions-secondary no-print">
              <button className="btn-ghost" onClick={shareSummary}>{copied ? `✓ ${ui.copiedBtn}` : `📤 ${ui.shareBtn}`}</button>
              <button className="btn-ghost" onClick={clearAll}>{ui.clearBtn}</button>
            </div>
          </section>
          {pdfFile && sourceAnchor && <PdfCitationViewer file={pdfFile} anchor={sourceAnchor} language={language} onClose={() => setSourceAnchor(null)} />}
          {imageFile && sourceBox && <ImageCitationViewer file={imageFile} box={sourceBox} language={language} quote={sourceQuote} onClose={() => setSourceBox(null)} />}
          {reviewingRow && !sourceAnchor && !sourceBox && (
            <ReviewRowDialog
              row={reviewingRow}
              language={language}
              where={pdfFile ? t('inPdf') : imageFile ? t('inPhoto') : t('inDocument')}
              canViewCitation={Boolean((pdfFile && reviewingRow.source_anchor) || (imageFile && reviewingRow.source_box))}
              onViewCitation={() => citeRow(reviewingRow)}
              onApprove={() => finishRowReview(reviewingRow.test_name, 'approve')}
              onReject={() => finishRowReview(reviewingRow.test_name, 'reject')}
              onClose={() => setReviewingTest(null)}
            />
          )}
          </div>
        )}

        {pendingPhoto && <PhotoCropDialog file={pendingPhoto} language={language} onConfirm={confirmCrop} onCancel={() => setPendingPhoto(null)} />}

        {report && showHandout && !showDoctor && (
          <FamilyHandout report={report} language={language} summary={display.summary} questions={display.questions} explain={display.explain} onBack={() => setShowHandout(false)} />
        )}
        {report && showDoctor && (
          <DoctorSheet report={report} language={language} summary={display.summary} questions={display.questions} flagged={flagged} testDate={testDate} onTestDate={setTestDate} onBack={() => setShowDoctor(false)} onClear={clearAll} />
        )}

        <footer className="no-print"><p>{ui.footerNote}</p></footer>
      </main>
    </>
  );
}
