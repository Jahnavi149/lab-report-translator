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
