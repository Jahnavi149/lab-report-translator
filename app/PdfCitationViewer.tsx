'use client';

import { useEffect, useRef, useState } from 'react';
import type { PdfSourceAnchor } from '@/lib/types';

type PdfDocument = Awaited<ReturnType<typeof import('pdfjs-dist').getDocument>['promise']>;

export function PdfCitationViewer({ file, anchor, onClose }: { file: File; anchor: PdfSourceAnchor; onClose: () => void }) {
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(anchor.page);
  const [pageCount, setPageCount] = useState(0);
  const [width, setWidth] = useState(620);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [highlights, setHighlights] = useState<{ left: number; top: number; width: number; height: number }[]>([]);
  const [error, setError] = useState('');
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    let cancelled = false;
    let loadingTask: { promise: Promise<PdfDocument>; destroy: () => Promise<void> } | undefined;
    setPdf(null);
    setError('');
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        const data = new Uint8Array(await file.arrayBuffer());
        loadingTask = pdfjs.getDocument({ data });
        const loaded = await loadingTask.promise;
        if (cancelled) { await loadingTask.destroy(); return; }
        setPdf(loaded);
        setPageCount(loaded.numPages);
      } catch {
        if (!cancelled) setError('This PDF could not be shown here. You can still use the extracted results.');
      }
    })();
    return () => { cancelled = true; if (loadingTask) void loadingTask.destroy(); };
  }, [file]);

  useEffect(() => {
    if (!frameRef.current) return;
    const observer = new ResizeObserver((entries) => setWidth(Math.max(240, entries[0]?.contentRect.width ?? 620)));
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPageNumber(anchor.page);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [anchor]);

  useEffect(() => {
    if (highlights.length === 0) return;
    const sourceTop = Math.min(...highlights.map((rect) => rect.top));
    scrollRef.current?.scrollTo({ top: Math.max(0, sourceTop - 100), behavior: 'smooth' });
  }, [highlights, pageSize]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | undefined;
    void (async () => {
      if (!pdf || !canvasRef.current || pageNumber < 1 || pageNumber > pdf.numPages) return;
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, Math.max(0.1, (width - 24) / base.width));
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(viewport.width * dpr);
        canvas.height = Math.ceil(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setPageSize({ width: viewport.width, height: viewport.height });
        const rects = anchor.page === pageNumber ? anchor.rects.map((rect) => {
          const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([rect.x, rect.y, rect.x + rect.width, rect.y + rect.height]);
          return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
        }) : [];
        setHighlights(rects);
        renderTask = page.render({ canvasContext: context, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
        await renderTask.promise;
      } catch (e) {
        if (!cancelled && !(e instanceof Error && e.name === 'RenderingCancelledException')) setError('This PDF page could not be rendered.');
      }
    })();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [pdf, pageNumber, width, anchor]);

  return (
    <div className="pdf-drawer-root">
      <button className="pdf-drawer-backdrop" type="button" onClick={onClose} aria-label="Close PDF viewer" tabIndex={-1} />
      <aside className="pdf-citation-panel" role="dialog" aria-modal="true" aria-label="Original PDF source">
        <div className="pdf-citation-head">
          <div><strong>Original report</strong><div className="muted small">Source selected from page {anchor.page}</div></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close PDF viewer">Close</button>
        </div>
        <div className="pdf-page-controls">
          <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((n) => n - 1)}>Previous</button>
          <span>Page {pageNumber}{pageCount ? ` of ${pageCount}` : ''}</span>
          <button type="button" disabled={!pageCount || pageNumber >= pageCount} onClick={() => setPageNumber((n) => n + 1)}>Next</button>
        </div>
        <div className="pdf-view-scroll" ref={scrollRef}>
          <div className="pdf-page-frame" ref={frameRef}>
            {!pdf && !error && <p className="muted">Opening PDF…</p>}
            {error && <p className="error">{error}</p>}
            <div className="pdf-page-canvas" style={{ width: pageSize.width, height: pageSize.height }}>
              <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} />
              {highlights.map((rect, i) => <div key={i} className="pdf-highlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />)}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
