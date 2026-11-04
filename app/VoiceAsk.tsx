'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ui } from '@/lib/i18n';
import type { LabReport, Language, VoiceExchange } from '@/lib/types';
import type { VoiceAction, VoiceResult } from '@/lib/voice';

// Voice Q&A on the results page. Input is the browser's own speech recognition (webkitSpeechRecognition, with the
// standard SpeechRecognition as a fallback); output is the page's existing speakItems pipeline, so voice selection per
// language is exactly what Listen mode does. The question goes to /api/voice-ask, where code picks one of four intents,
// Muse writes the words inside two of them, and lib/safety.ts checks every answer before it comes back here.
//
// Nothing here can break the page: with no recognition support, no microphone, an unsupported language or no API key,
// the button shows a plain message and disables itself, and everything else keeps working.

interface RecResult { isFinal: boolean; 0?: { transcript: string } }
interface RecEvent { resultIndex: number; results: ArrayLike<RecResult> }
interface Rec {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: RecEvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecCtor = new () => Rec;
const recognitionCtor = (): RecCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
const VOICE_LANGUAGES: Language[] = ['en', 'te', 'hi', 'es'];

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';
type Speak = (items: string[], lang: string, onIndex: (i: number | null) => void, onDone: () => void) => Promise<void> | void;

export interface VoiceAskOptions {
  report: LabReport | null;
  language: Language;
  ui: Ui;
  /** BCP-47 tag for recognition and for speaking a translated answer (te-IN, hi-IN, ...). */
  voiceLang: string;
  speak: Speak;
  stopSpeaking: () => void;
  /** The summary lines the page is showing (translated when the page is), shown when the summary is read aloud. */
  displaySummary: string[];
  /** Reads the summary the page is showing (highlighting each line), then calls back. */
  speakSummary: (onDone: () => void) => void;
  perform: (action: VoiceAction) => void;
}

export interface VoiceAsk {
  state: VoiceState;
  transcript: string;
  answer: { text: string; english?: string; redirected: boolean } | null;
  message: string;
  exchanges: VoiceExchange[];
  /** Why the mic is switched off, in the user's language; null when it works. */
  disabledReason: string | null;
  toggle: () => void;
}

export function useVoiceAsk(o: VoiceAskOptions): VoiceAsk {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState<VoiceAsk['answer']>(null);
  const [message, setMessage] = useState('');
  const [exchanges, setExchanges] = useState<VoiceExchange[]>([]);
  const [supported, setSupported] = useState(true);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState(false);
  const recRef = useRef<Rec | null>(null);
  const live = useRef(o);
  live.current = o;

  useEffect(() => { setSupported(recognitionCtor() !== null); }, []);
  // Is a Muse key configured on the server? (Asked once; a failed request just leaves the mic enabled.)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/voice-ask').then((r) => r.json()).then((d) => { if (!cancelled && typeof d?.available === 'boolean') setAvailable(d.available); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // A new or cleared report starts a clean conversation.
  useEffect(() => {
    recRef.current?.abort(); recRef.current = null;
    setState('idle'); setTranscript(''); setAnswer(null); setMessage(''); setExchanges([]);
  }, [o.report]);
  useEffect(() => () => { recRef.current?.abort(); }, []);

  const disabledReason: string | null = !supported ? o.ui.micUnsupported
    : available === false ? o.ui.micNoKey
    : !VOICE_LANGUAGES.includes(o.language) ? o.ui.micLanguage
    : blocked ? o.ui.micDenied
    : null;

  const ask = useCallback(async (question: string) => {
    const { report, language, ui, voiceLang, speak, speakSummary, perform } = live.current;
    if (!report) { setState('idle'); return; }
    setState('thinking');
    try {
      const rows = report.ai_input?.rows ?? report.rows.map((r) => ({ test_name: r.test_name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high, flag: r.flag }));
      const res = await fetch('/api/voice-ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, lang: language, rows, summary: report.summary, questions: report.questions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503 || res.status === 501) setAvailable(false);
        setMessage(typeof data?.error === 'string' ? data.error : ui.micError);
        setState('idle');
        return;
      }
      const result = data as VoiceResult;
      const readsSummary = result.action?.type === 'speak-summary';
      const shown = readsSummary ? live.current.displaySummary.join(' ') || result.answer : result.answer_local ?? result.answer;
      setAnswer({ text: shown, english: result.answer_local ? result.answer : undefined, redirected: result.redirected });
      setExchanges((prev) => [...prev, { question, answer: result.answer, intent: result.intent, redirected: result.redirected, sent_to_ai: result.sent_to_ai, question_sent: result.question_sent }]);
      if (result.action && !readsSummary) perform(result.action);
      setState('speaking');
      const done = () => setState('idle');
      if (readsSummary) speakSummary(done);
      else void speak([shown], result.answer_local ? voiceLang : 'en-US', () => {}, done);
    } catch {
      setMessage(live.current.ui.micError);
      setState('idle');
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    const { ui, voiceLang, stopSpeaking } = live.current;
    if (!Ctor) { setSupported(false); return; }
    stopSpeaking(); // Listen mode or a previous answer ends first
    const rec = new Ctor();
    rec.lang = voiceLang; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    let finalText = '', heard = '', error = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r?.[0]?.transcript ?? '';
        if (r?.isFinal) finalText += t; else interim += t;
      }
      heard = `${finalText}${interim}`.trim();
      setTranscript(heard);
    };
    rec.onerror = (e) => { error = e.error; };
    rec.onend = () => {
      recRef.current = null;
      if (error === 'not-allowed' || error === 'service-not-allowed' || error === 'audio-capture') { setBlocked(true); setState('idle'); return; }
      const said = (finalText || heard).trim();
      if (!said) { setMessage(error && error !== 'no-speech' && error !== 'aborted' ? ui.micError : ui.micNoSpeech); setState('idle'); return; }
      void ask(said);
    };
    setTranscript(''); setAnswer(null); setMessage('');
    recRef.current = rec;
    setState('listening');
    try { rec.start(); } catch { recRef.current = null; setMessage(ui.micError); setState('idle'); }
  }, [ask]);

  const toggle = useCallback(() => {
    if (disabledReason) return;
    if (state === 'listening') { recRef.current?.stop(); return; }
    if (state === 'speaking') { live.current.stopSpeaking(); setState('idle'); return; }
    if (state === 'thinking') return;
    start();
  }, [disabledReason, state, start]);

  return { state, transcript, answer, message, exchanges, disabledReason, toggle };
}

/** The mic button. Sits next to Listen. */
export function VoiceButton({ v, ui }: { v: VoiceAsk; ui: Ui }) {
  const label = v.state === 'listening' ? ui.micListening : v.state === 'thinking' ? ui.micThinking : v.state === 'speaking' ? ui.micSpeaking : ui.micBtn;
  return (
    <button type="button" className={`big mic-btn ${v.state}`} onClick={v.toggle} disabled={Boolean(v.disabledReason) || v.state === 'thinking'}
      aria-pressed={v.state === 'listening'} aria-label={v.disabledReason ?? label} title={v.disabledReason ?? label}>
      <span aria-hidden="true">{v.state === 'listening' ? '🎙' : v.state === 'speaking' ? '🔊' : v.state === 'thinking' ? '…' : '🎤'}</span> {label}
    </button>
  );
}

/** What was heard, the answer, and a calm note when the question was handed back to the doctor. */
export function VoicePanel({ v, ui }: { v: VoiceAsk; ui: Ui }) {
  return (
    <div className="voice-panel no-print" aria-live="polite">
      {v.disabledReason ? <p className="muted small" role="status">{v.disabledReason}</p> : !v.transcript && !v.answer && !v.message && <p className="muted small">{ui.micHint}</p>}
      {v.message && <p role="status">{v.message}</p>}
      {v.transcript && <p className="voice-heard"><strong>{ui.youAskedLabel}:</strong> “{v.transcript}”</p>}
      {v.answer && (
        <div className="voice-answer">
          <strong>{ui.answerLabel}:</strong> <span className="bigtext">{v.answer.text}</span>
          {v.answer.english && <div className="muted small">{v.answer.english}</div>}
          {v.answer.redirected && <p className="voice-note">{ui.askedDoctorNote}</p>}
        </div>
      )}
    </div>
  );
}
