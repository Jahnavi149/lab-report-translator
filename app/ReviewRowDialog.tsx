'use client';

import { useEffect, useRef } from 'react';
import { formatRangeCompact, formatValue } from '@/lib/flags';
import type { LabRow } from '@/lib/types';

interface Props {
  row: LabRow;
  citationSource: 'PDF' | 'photo' | 'document';
  canViewCitation: boolean;
  onViewCitation: () => void;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

export function ReviewRowDialog({ row, citationSource, canViewCitation, onViewCitation, onApprove, onReject, onClose }: Props) {
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
      <button className="review-dialog-backdrop" type="button" onClick={onClose} aria-label="Close result review" tabIndex={-1} />
      <div className="review-dialog" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="review-dialog-title" aria-describedby="review-dialog-help">
        <div className="review-dialog-head">
          <h2 id="review-dialog-title">Review {row.test_name}</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close result review">Close</button>
        </div>

        <p id="review-dialog-help">Review the values against the original document and its citation before approving or rejecting this result.</p>
        {row.review_reason && <p className="warn review-reason"><strong>Why it needs review:</strong> {row.review_reason}</p>}

        <dl className="review-values">
          <div><dt>Value</dt><dd>{formatValue(row.value, row.unit)}</dd></div>
          <div><dt>Printed range</dt><dd>{formatRangeCompact(row.ref_low, row.ref_high, row.unit, 'Not on report')}</dd></div>
          <div><dt>Flag</dt><dd><span className={`flag ${row.flag}`}>{row.flag}</span></dd></div>
        </dl>

        <div className="review-citation">
          <h3>Document citation</h3>
          <p className="small">Extracted from: <code>{row.source_text}</code></p>
          {canViewCitation
            ? <button type="button" className="pdf-citation-button" onClick={onViewCitation}>🔎 View citation in {citationSource}</button>
            : <p className="muted small">A clickable citation is not available for this result. Compare it directly with the original document.</p>}
        </div>

        <div className="review-dialog-actions">
          <button type="button" className="danger" onClick={onReject}>Reject result</button>
          <button type="button" className="primary" onClick={onApprove}>Approve result</button>
        </div>
      </div>
    </div>
  );
}
