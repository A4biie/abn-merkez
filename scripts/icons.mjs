// Uygulama ikonlarını components/Logo.tsx'teki SVG yollarından çizer (evenodd, 4x4 örnekleme).
// Çalıştırmak için: node scripts/icons.mjs
// İşaret uygulamadakiyle aynı: sel-bg (#F4F4F5) daire, içinde sel-fg (#0E0E10) logo, ABN Koyu zemin.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Jimp = require('jimp-compact');
const root = fileURLToPath(new URL('../', import.meta.url));

// components/Logo.tsx ile aynı.
const VIEW = { x: 160, y: 170, w: 680, h: 662 };
const PATHS = [
  'M174 263 L260 263 L334 334 L500 183 L666 334 L740 263 L826 263 L826 690 L760 627 L760 565 L500 818 L240 565 L240 627 L174 690 Z',
  'M236 328 L286 377 L236 427 Z',
  'M764 328 L714 377 L764 427 Z',
  'M475 301 L475 470 L385 383 Z',
  'M525 301 L615 383 L525 470 Z',
  'M336 427 L476 564 L476 705 L260 497 Z',
  'M664 427 L740 497 L524 705 L524 564 Z',
];
const POLYS = PATHS.map((d) => [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [+m[1], +m[2]]));

/** evenodd: bütün çokgenlerin kenarlarını birlikte say. */
function inLogo(x, y) {
  let inside = false;
  for (const poly of POLYS) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const INK = hex('#0E0E10');
const SEL = hex('#F4F4F5');

/**
 * size: kare tuval. bg: zemin rengi ya da null (şeffaf). circle: dairenin çapı / size (0 = daire yok).
 * logo: logo genişliği / size. logoColor ve circleColor.
 */
async function render(file, size, { bg = null, circle = 0.76, logo = circle * 0.58, logoColor = INK, circleColor = SEL, dot = null }) {
  const img = new Jimp(size, size, 0x00000000);
  const SS = 4;
  const lw = logo * size;
  const lh = lw * (VIEW.h / VIEW.w);
  const ox = (size - lw) / 2;
  const oy = (size - lh) / 2;
  const r = (circle * size) / 2;
  const c = size / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          const inCircle = circle > 0 && (x - c) ** 2 + (y - c) ** 2 <= r * r;
          const vx = VIEW.x + ((x - ox) / lw) * VIEW.w;
          const vy = VIEW.y + ((y - oy) / lh) * VIEW.h;
          const onLogo = (circle === 0 || inCircle) && inLogo(vx, vy);
          let col = null;
          // Okunmamış bildirim noktası: sağ üstte, koyu halkalı (tepsi simgesi için).
          const dr = dot ? size * 0.2 : 0;
          const dx = size - dr - size * 0.02;
          const dy = dr + size * 0.02;
          const dd = dot ? (x - dx) ** 2 + (y - dy) ** 2 : Infinity;
          if (dd <= dr * dr) col = dd <= (dr * 0.72) ** 2 ? dot : INK;
          else if (onLogo) col = logoColor;
          else if (inCircle) col = circleColor;
          else if (bg) col = bg;
          if (col) acc = [acc[0] + col[0], acc[1] + col[1], acc[2] + col[2], acc[3] + 1];
        }
      }
      if (!acc[3]) continue;
      const i = (py * size + px) * 4;
      img.bitmap.data[i] = Math.round(acc[0] / acc[3]);
      img.bitmap.data[i + 1] = Math.round(acc[1] / acc[3]);
      img.bitmap.data[i + 2] = Math.round(acc[2] / acc[3]);
      img.bitmap.data[i + 3] = Math.round((acc[3] / (SS * SS)) * 255);
    }
  }
  await img.writeAsync(root + file);
  console.log('yazıldı', file);
}

await render('assets/images/icon.png', 1024, { bg: INK, circle: 0.76 });
await render('assets/images/android-icon-background.png', 512, { bg: INK, circle: 0, logo: 0 });
// Uyarlanabilir ikonun güvenli alanı tuvalin ortadaki %66'sı.
await render('assets/images/android-icon-foreground.png', 512, { circle: 0.6 });
await render('assets/images/android-icon-monochrome.png', 432, { circle: 0, logo: 0.42, logoColor: [255, 255, 255] });
await render('assets/images/favicon.png', 48, { circle: 1 });
await render('public/icons/icon-192.png', 192, { bg: INK, circle: 0.72 });
await render('public/icons/icon-512.png', 512, { bg: INK, circle: 0.72 });
await render('public/icons/apple-touch-icon.png', 180, { bg: INK, circle: 0.78 });

// ABN Launcher tepsi simgesi: logo; okunmamış bildirim varsa noktalı.
await render('src-tauri/icons/tray.png', 32, { circle: 1 });
await render('src-tauri/icons/tray-dot.png', 32, { circle: 1, dot: hex('#E4F68F') });
