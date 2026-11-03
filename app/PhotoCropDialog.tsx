'use client';

import { useEffect, useRef, useState } from 'react';
import { cropIsValid, type CropEdges } from '@/lib/clientImage';

// Privacy step for photos. A photo cannot be redacted by code, so the user trims it first: the part outside the
// crop is cut off in this browser and never uploaded. Sliders (not drag handles) so it works with a keyboard,
// a screen reader and a thumb.
const NONE: CropEdges = { top: 0, right: 0, bottom: 0, left: 0 };
const MAX_TRIM = 0.8; // top + bottom (and left + right) may never leave less than 20% / 10% of the picture

const EDGES: { key: keyof CropEdges; label: string; opposite: keyof CropEdges }[] = [
  { key: 'top', label: 'Trim from the top', opposite: 'bottom' },
  { key: 'bottom', label: 'Trim from the bottom', opposite: 'top' },
  { key: 'left', label: 'Trim from the left', opposite: 'right' },
  { key: 'right', label: 'Trim from the right', opposite: 'left' },
];

export function PhotoCropDialog({ file, onConfirm, onCancel }: { file: File; onConfirm: (edges: CropEdges) => void; onCancel: () => void }) {
  const [url, setUrl] = useState('');
  const [edges, setEdges] = useState<CropEdges>(NONE);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus(); // focus the dialog itself so it opens at the top, where the privacy notice is
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancelRef.current(); };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener('keydown', onKeyDown); previouslyFocused?.focus(); };
  }, []);

  const set = (key: keyof CropEdges, opposite: keyof CropEdges, value: number) =>
    setEdges((e) => ({ ...e, [key]: Math.min(value, MAX_TRIM - e[opposite]) }));
  const trimmed = cropIsValid(edges);

  return (
    <div className="pdf-drawer-root">
      <button className="pdf-drawer-backdrop" type="button" onClick={onCancel} aria-label="Cancel" tabIndex={-1} />
      <div className="crop-dialog" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="crop-title">
        <h2 id="crop-title">Crop out your name before reading</h2>
        <p className="warn" style={{ marginTop: 0 }}>
          <strong>This photo is sent to Meta&apos;s Muse AI to be read.</strong> A picture cannot be censored automatically,
          so trim away the header with your name, date of birth and ID, and keep only the results table. The trimmed part never leaves this device.
        </p>
        <div className="crop-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url && <img src={url} alt="Your lab report photo. Use the sliders to trim it." />}
          <div className="crop-shade" style={{ left: 0, right: 0, top: 0, height: `${edges.top * 100}%` }} />
          <div className="crop-shade" style={{ left: 0, right: 0, bottom: 0, height: `${edges.bottom * 100}%` }} />
          <div className="crop-shade" style={{ left: 0, width: `${edges.left * 100}%`, top: `${edges.top * 100}%`, bottom: `${edges.bottom * 100}%` }} />
          <div className="crop-shade" style={{ right: 0, width: `${edges.right * 100}%`, top: `${edges.top * 100}%`, bottom: `${edges.bottom * 100}%` }} />
        </div>
        <div className="crop-sliders">
          {EDGES.map(({ key, label, opposite }) => (
            <label key={key}>{label}
              <input type="range" min={0} max={MAX_TRIM * 100} step={1} value={Math.round(edges[key] * 100)} onChange={(e) => set(key, opposite, Number(e.target.value) / 100)} />
            </label>
          ))}
        </div>
        <div className="row">
          <button className="primary big" onClick={() => onConfirm(edges)}>{trimmed ? 'Read the cropped photo' : 'Read this photo as it is'}</button>
          {trimmed && <button className="big" onClick={() => setEdges(NONE)}>Reset crop</button>}
          <button className="big" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
