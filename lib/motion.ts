// Ortak hareket eğrileri ve süreleri (0.7.0). Hem worklet'te hem JS'te çalışır.
// CSS animasyonlu eski yardımcılar theme/motion.ts içinde; yeni animasyonlar buradaki sabitleri kullanır.

/** cubic-bezier(x1, y1, x2, y2) eğrisi: t (0–1) → ilerleme. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  'worklet';
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  return (t: number) => {
    'worklet';
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // x(s) = t çözümü: birkaç Newton adımı, olmazsa ikiye bölme.
    let s = t;
    for (let i = 0; i < 6; i++) {
      const x = ((ax * s + bx) * s + cx) * s - t;
      const d = (3 * ax * s + 2 * bx) * s + cx;
      if (Math.abs(x) < 1e-5) break;
      if (Math.abs(d) < 1e-6) break;
      s -= x / d;
    }
    if (s < 0 || s > 1) {
      let lo = 0;
      let hi = 1;
      s = t;
      for (let i = 0; i < 20; i++) {
        const x = ((ax * s + bx) * s + cx) * s;
        if (x < t) lo = s;
        else hi = s;
        s = (lo + hi) / 2;
      }
    }
    return ((ay * s + by) * s + cy) * s;
  };
}

/** Eğri değerleri: out = cubic-bezier(.22,1,.36,1), spring = (.34,1.5,.6,1), io = (.65,0,.35,1). */
export const CURVE = {
  out: [0.22, 1, 0.36, 1],
  spring: [0.34, 1.5, 0.6, 1],
  io: [0.65, 0, 0.35, 1],
} as const;

export const ease = {
  out: bezier(0.22, 1, 0.36, 1),
  spring: bezier(0.34, 1.5, 0.6, 1),
  io: bezier(0.65, 0, 0.35, 1),
};

/** Ortak süreler (ms). */
export const DURATION = { fast: 200, base: 450, slow: 600 } as const;

/** t, [start, end] aralığında 0–1 arası ilerleme (öncesi 0, sonrası 1). */
export function span(t: number, start: number, end: number) {
  'worklet';
  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}
