// Turns a digital PDF into text lines, grouping text items that share a baseline (within a few points)
// so that table cells on the same visual row end up on the same line.
export async function extractPdfText(buffer: Buffer | Uint8Array): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = (content.items as { str?: string; transform?: number[] }[])
      .filter((it) => (it.str ?? '').trim().length > 0)
      .map((it) => ({ x: it.transform?.[4] ?? 0, y: it.transform?.[5] ?? 0, str: it.str ?? '' }))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: { y: number; parts: { x: number; str: string }[] }[] = [];
    for (const it of items) {
      const line = lines.find((l) => Math.abs(l.y - it.y) <= 3);
      if (line) line.parts.push({ x: it.x, str: it.str });
      else lines.push({ y: it.y, parts: [{ x: it.x, str: it.str }] });
    }
    pages.push(lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(' ')).join('\n'));
  }
  return pages.join('\n');
}
