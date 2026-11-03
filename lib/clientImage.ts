// Browser only. Redraws a photo upright, on a white background and at a sensible size, so that the photo
// the reader sees, the photo the OCR reads and the photo Muse reads are the same picture:
//  - stored phone rotation (EXIF) is applied, so line positions match what is on screen
//  - transparent areas (screenshots) become white instead of black
//  - huge photos are scaled down (faster uploads); small ones are scaled up, because OCR misses small print
const MAX_EDGE = 2400;
const MIN_EDGE = 1600;

export async function normalizeImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longEdge < MIN_EDGE ? Math.min(3, MIN_EDGE / longEdge) : Math.min(1, MAX_EDGE / longEdge);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Edges to trim, as fractions (0 to 1) of the picture. */
export interface CropEdges { top: number; right: number; bottom: number; left: number }

export const isImageFile = (file: File): boolean => file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);

/** True when the edges leave a usable picture and trim something. */
export function cropIsValid(c: CropEdges): boolean {
  const w = 1 - c.left - c.right, h = 1 - c.top - c.bottom;
  return w >= 0.2 && h >= 0.1 && (c.top > 0 || c.right > 0 || c.bottom > 0 || c.left > 0);
}

/**
 * Cuts the trimmed edges off a photo in the browser. The cut-off part (for example the header with the patient's
 * name) is never uploaded. Expects an already normalised (upright) image.
 */
export async function cropImage(file: File, c: CropEdges): Promise<File> {
  if (!cropIsValid(c)) return file;
  const bitmap = await createImageBitmap(file);
  const sx = Math.round(bitmap.width * c.left), sy = Math.round(bitmap.height * c.top);
  const sw = Math.max(1, Math.round(bitmap.width * (1 - c.left - c.right))), sh = Math.max(1, Math.round(bitmap.height * (1 - c.top - c.bottom)));
  const canvas = document.createElement('canvas');
  canvas.width = sw; canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not crop this photo in your browser.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Could not crop this photo in your browser.');
  return new File([blob], file.name, { type: 'image/jpeg' });
}
