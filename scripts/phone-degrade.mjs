// Makes a screenshot look like a phone photo: perspective tilt, rotation, uneven light, glare, defocus blur, sensor noise,
// JPEG compression. Deterministic (fixed noise seed) so runs are comparable. Used by simulate-phone.mjs and make-phi-fixtures.mjs.
import sharp from 'sharp';

// Deterministic noise so runs are comparable.
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

export const LEVELS = {
  mild:   { tilt: 0.03, rot: 2,  blur: 0.6, noise: 4,  q: 80, shadow: 0.12, glare: 0.10, width: 1600 },
  medium: { tilt: 0.07, rot: 5,  blur: 1.1, noise: 8,  q: 65, shadow: 0.25, glare: 0.22, width: 1400 },
  harsh:  { tilt: 0.12, rot: 9,  blur: 1.8, noise: 14, q: 45, shadow: 0.40, glare: 0.35, width: 1100 },
};

export async function degrade(srcPath, L) {
  const { data, info } = await sharp(srcPath).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sw = info.width, sh = info.height;
  // Output canvas: the page sits on a desk with margin, then everything is viewed at an angle.
  const W = L.width, H = Math.round(W * (sh / sw) * 1.0 + W * 0.12);
  const margin = W * 0.06;
  const pw = W - 2 * margin, ph = pw * (sh / sw);
  const cx = W / 2, cy = H / 2, rad = (L.rot * Math.PI) / 180;
  // Keystone: top edge narrower than bottom (camera tilted back). Mapped per row.
  const out = Buffer.alloc(W * H * 3);
  const gx = W * (0.7 + 0.2 * rnd()), gy = H * (0.2 + 0.3 * rnd()), gr = W * 0.35;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // undo rotation about the centre
      const dx = x - cx, dy = y - cy;
      let ux = dx * Math.cos(-rad) - dy * Math.sin(-rad) + cx;
      let uy = dx * Math.sin(-rad) + dy * Math.cos(-rad) + cy;
      // undo keystone: scale about vertical axis depends on y
      const t = uy / H; // 0 top, 1 bottom
      const scale = 1 - L.tilt * (1 - t) * 2; // top is smaller
      ux = cx + (ux - cx) / scale;
      const px = ((ux - margin) / pw) * sw, py = ((uy - (H - ph) / 2) / ph) * sh;
      const o = (y * W + x) * 3;
      let r, g, b;
      if (px >= 0 && py >= 0 && px < sw - 1 && py < sh - 1) {
        const x0 = px | 0, y0 = py | 0, fx = px - x0, fy = py - y0;
        const i00 = (y0 * sw + x0) * 3, i10 = i00 + 3, i01 = i00 + sw * 3, i11 = i01 + 3;
        const m = (c) => (data[i00 + c] * (1 - fx) + data[i10 + c] * fx) * (1 - fy) + (data[i01 + c] * (1 - fx) + data[i11 + c] * fx) * fy;
        r = m(0); g = m(1); b = m(2);
      } else { r = 70; g = 62; b = 55; } // desk
      // uneven lighting: darker toward one corner, plus a soft glare spot
      const shade = 1 - L.shadow * ((x / W) * 0.6 + (y / H) * 0.4);
      const d2 = ((x - gx) ** 2 + (y - gy) ** 2) / (gr * gr);
      const glare = L.glare * 255 * Math.exp(-d2 * 2.2);
      r = r * shade + glare; g = g * shade + glare; b = b * shade + glare;
      const n = gauss() * L.noise;
      out[o] = Math.max(0, Math.min(255, r + n)); out[o + 1] = Math.max(0, Math.min(255, g + n)); out[o + 2] = Math.max(0, Math.min(255, b + n));
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } }).blur(L.blur).jpeg({ quality: L.q });
}

