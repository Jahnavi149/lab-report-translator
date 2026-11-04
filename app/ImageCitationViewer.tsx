'use client';

import { useEffect, useRef, useState } from 'react';
import { appText } from '@/lib/i18n-app';
import type { ImageSourceBox, Language } from '@/lib/types';

// Same side drawer as the PDF viewer, for a photo upload: shows the original image and outlines the line the
// result was read from. The box comes from the model, so it is a pointer for the reader, never a source of truth.
export function ImageCitationViewer({ file, box, quote, language, onClose }: { file: File; box: ImageSourceBox; quote: string; language: Language; onClose: () => void }) {
  const t = appText(language);
  const [url, setUrl] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // Bring the highlighted line into view once the image has its size, and again if another row is chosen.
  function scrollToBox() {
    const frame = frameRef.current, scroller = scrollRef.current;
    if (!frame || !scroller) return;
    scroller.scrollTo({ top: Math.max(0, box.y * frame.clientHeight - 100), behavior: 'smooth' });
  }
  useEffect(scrollToBox, [box]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pdf-drawer-root">
      <button className="pdf-drawer-backdrop" type="button" onClick={onClose} aria-label={t('closePhotoViewer')} tabIndex={-1} />
      <aside className="pdf-citation-panel" role="dialog" aria-modal="true" aria-label={t('photoSourceAria')}>
        <div className="pdf-citation-head">
          <div><strong>{t('originalPhoto')}</strong><div className="muted small">{t('photoOutlined')} <code>{quote}</code></div></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={t('closePhotoViewer')}>{t('close')}</button>
        </div>
        <div className="pdf-view-scroll" ref={scrollRef}>
          <div className="image-frame" ref={frameRef}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {url && <img src={url} alt={t('photoAlt')} onLoad={scrollToBox} />}
            <div className="pdf-highlight" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }} />
          </div>
        </div>
      </aside>
    </div>
  );
}
