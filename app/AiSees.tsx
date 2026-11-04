'use client';

import { appText, type AppKey } from '@/lib/i18n-app';
import type { AiInputDisclosure, Language, VoiceExchange } from '@/lib/types';

// The trust moment: shows the exact data the AI was given for this report.
export function AiSees({ input, voice = [], language }: { input: AiInputDisclosure; voice?: VoiceExchange[]; language: Language }) {
  const n = input.identifiers_removed;
  const sent = voice.filter((v) => v.sent_to_ai);
  const redirected = voice.filter((v) => v.redirected).length;
  const payload = {
    ...(input.photo ? { picture: 'The cleaned photo shown below, sent once so the results can be read from it.' } : {}),
    ...(input.redacted_report_text ? { redacted_pdf_text_for_extraction: input.redacted_report_text } : {}),
    results_sent: input.rows,
    ...(input.source_lines.length > 0 ? { result_lines_for_second_check: input.source_lines } : {}),
    ...(voice.length > 0 ? { voice_questions: { asked: voice.length, sent_to_ai: sent.length, handed_back_to_doctor: redirected, sent: sent.map((v) => ({ question: v.question_sent, answer: v.redirected ? '(not used: answer failed the safety check)' : v.answer })) } } : {}),
  };
  const t = appText(language);
  const KIND_KEYS: Record<string, AppKey> = { email: 'kindEmail', 'web address': 'kindWeb', 'IP address': 'kindIp', date: 'kindDate', 'phone or ID number': 'kindPhoneId', 'ID number': 'kindId', 'name or ID line': 'kindNameLine', 'age over 89': 'kindAge' };
  const kinds = input.removed_kinds.length > 0 ? ` (${input.removed_kinds.map((k) => (KIND_KEYS[k] ? t(KIND_KEYS[k]) : k)).join(', ')})` : '';
  const items = [
    input.photo ? t('itemCleanedPhoto') : input.redacted_report_text ? t('itemRedactedPdf') : '',
    t('itemRows'),
    input.source_lines.length > 0 ? t('itemResultLines') : '',
  ].filter(Boolean).join(', ');
  return (
    <section className="privacy-badge no-print" aria-label={t('privacyAria')}>
      <span aria-hidden="true">🔒</span>
      <div>
        <strong>
          {input.photo
            ? n > 0 ? t('photoCleaned', { n, kinds }) : t('photoChecked')
            : n > 0 ? t('pdfIdsRemoved', { n, kinds }) : t('pdfChecked')}
        </strong>{' '}
        <span className="muted small">
          {input.photo ? t('photoPanelNote') : t('pdfPanelNote')}
        </span>
        {voice.length > 0 && <div className="muted small">{t('voiceSummary', { asked: voice.length, sent: sent.length })}{redirected > 0 ? ` ${t('voiceHanded', { n: redirected })}` : ''} {t('voicePrivacy')}</div>}
        {input.lines_withheld > 0 && <div className="muted small">{t('linesWithheld', { n: input.lines_withheld })}</div>}
        <details className="ai-sees">
          <summary>{t('whatAiSees')}</summary>
          <p className="muted small">{t('aiSeesIntro', { items })}</p>
          {input.photo_preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="ai-photo" src={input.photo_preview} alt={t('aiPhotoAlt')} />
          )}
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </details>
      </div>
    </section>
  );
}
