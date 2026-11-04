'use client';

import { useEffect, useRef } from 'react';
import { formatRangeCompact, formatValue } from '@/lib/flags';
import { flagLabel } from '@/lib/i18n';
import { appText, localizeServerText } from '@/lib/i18n-app';
import type { LabRow, Language } from '@/lib/types';

interface Props {
  row: LabRow;
  language: Language;
  /** "in the PDF" / "in the photo" / "in the document", already in the user's language. */
  where: string;
  canViewCitation: boolean;
  onViewCitation: () => void;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

export function ReviewRowDialog({ row, language, where, canViewCitation, onViewCitation, onApprove, onReject, onClose }: Props) {
  const t = appText(language);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="review-dialog-root no-print">
      <button className="review-dialog-backdrop" type="button" onClick={onClose} aria-label={t('closeReview')} tabIndex={-1} />
      <div className="review-dialog" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="review-dialog-title" aria-describedby="review-dialog-help">
        <div className="review-dialog-head">
          <h2 id="review-dialog-title">{t('reviewTitle', { test: row.test_name })}</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={t('closeReview')}>{t('close')}</button>
        </div>

        <p id="review-dialog-help">{t('reviewHelp')}</p>
        {row.review_reason && <p className="warn review-reason"><strong>{t('whyReview')}</strong> {localizeServerText(row.review_reason, language)}</p>}

        <dl className="review-values">
          <div><dt>{t('valueLabel')}</dt><dd>{formatValue(row.value, row.unit, undefined, row.qualifier)}</dd></div>
          <div><dt>{t('printedRange')}</dt><dd>{formatRangeCompact(row.ref_low, row.ref_high, row.unit, t('notOnReport'))}</dd></div>
          <div><dt>{t('flagWord')}</dt><dd><span className={`flag ${row.flag}`}>{flagLabel(language, row.flag)}</span></dd></div>
        </dl>

        <div className="review-citation">
          <h3>{t('citationHeading')}</h3>
          <p className="small">{t('extractedFrom')} <code>{row.source_text}</code></p>
          {canViewCitation
            ? <button type="button" className="pdf-citation-button" onClick={onViewCitation}>🔎 {t('viewCitationIn', { where })}</button>
            : <p className="muted small">{t('noCitation')}</p>}
        </div>

        <div className="review-dialog-actions">
          <button type="button" className="danger" onClick={onReject}>{t('rejectResult')}</button>
          <button type="button" className="primary" onClick={onApprove}>{t('approveResult')}</button>
        </div>
      </div>
    </div>
  );
}
