// Board.dc.html'deki geometri: bağlantı eğrisi (ortadaki tutamaçtan geçen ikinci dereceden Bézier),
// kenar noktaları, ok başları, bağlama noktaları ve sürükleme izinin kart biçimli zarfı.
// Hepsi worklet: UI iş parçacığında her karede çalışabilir.

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = [number, number];
export type CapKind = 'none' | 'dot' | 'arrow';

export function ctr(r: Rect): Pt {
  'worklet';
  return [r.x + r.w / 2, r.y + r.h / 2];
}

/** Kartın merkezinden (tx, ty) yönüne giden çizginin kart kenarına 8px uzaktaki noktası. */
export function edge(r: Rect, tx: number, ty: number): Pt {
  'worklet';
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (!dx && !dy) return [cx, cy];
  const sx = (r.w / 2 + 8) / Math.abs(dx || 1e-6);
  const sy = (r.h / 2 + 8) / Math.abs(dy || 1e-6);
  const k = Math.min(sx, sy);
  return [cx + dx * k, cy + dy * k];
}

export type LinkGeom = { p1: Pt; p2: Pt; c: Pt; h: Pt; mid: Pt };

/** Eğri, h (= iki merkezin ortası + bend) noktasından geçer; kontrol noktası buna göre bulunur. */
export function linkGeom(A: Rect, B: Rect, bx: number, by: number): LinkGeom {
  'worklet';
  const ca = ctr(A);
  const cb = ctr(B);
  const mx = (ca[0] + cb[0]) / 2;
  const my = (ca[1] + cb[1]) / 2;
  const hx = mx + bx;
  const hy = my + by;
  const p1 = edge(A, hx, hy);
  const p2 = edge(B, hx, hy);
  const c: Pt = [2 * hx - (p1[0] + p2[0]) / 2, 2 * hy - (p1[1] + p2[1]) / 2];
  return { p1, p2, c, h: [hx, hy], mid: [mx, my] };
}

function nrm(x: number, y: number): Pt {
  'worklet';
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

function r1(v: number) {
  'worklet';
  return Math.round(v * 10) / 10;
}

/** Çizgi (stroke) ve uçlar (dolgu: ok üçgeni ya da nokta) için iki ayrı path. */
export function linkPaths(g: LinkGeom, s: CapKind, e: CapKind) {
  'worklet';
  const { p1, p2, c } = g;
  const dE = nrm(p2[0] - c[0], p2[1] - c[1]);
  const dS = nrm(p1[0] - c[0], p1[1] - c[1]);
  const cut = (k: CapKind) => (k === 'arrow' ? 11 : k === 'dot' ? 3 : 0);
  const q1: Pt = [p1[0] - dS[0] * cut(s), p1[1] - dS[1] * cut(s)];
  const q2: Pt = [p2[0] - dE[0] * cut(e), p2[1] - dE[1] * cut(e)];
  const line = `M${r1(q1[0])} ${r1(q1[1])}Q${r1(c[0])} ${r1(c[1])} ${r1(q2[0])} ${r1(q2[1])}`;

  const tri = (t: Pt, d: Pt) => {
    const bx = t[0] - 12 * d[0];
    const by = t[1] - 12 * d[1];
    return `M${r1(t[0])} ${r1(t[1])}L${r1(bx - 6.5 * d[1])} ${r1(by + 6.5 * d[0])}L${r1(bx + 6.5 * d[1])} ${r1(by - 6.5 * d[0])}Z`;
  };
  const dot = (t: Pt) => `M${r1(t[0] - 5)} ${r1(t[1])}a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z`;
  let heads = '';
  if (e === 'arrow') heads += tri(p2, dE);
  if (e === 'dot') heads += dot(p2);
  if (s === 'arrow') heads += tri(p1, dS);
  if (s === 'dot') heads += dot(p1);
  return { line, heads: heads || 'M0 0' };
}

/** Noktanın eğriye uzaklığı (20 parçaya bölünerek). Bağlantıya dokunmayı bulmak için. */
export function distToLink(g: LinkGeom, px: number, py: number) {
  'worklet';
  let best = Infinity;
  let prev = g.p1;
  for (let i = 1; i <= 20; i++) {
    const t = i / 20;
    const u = 1 - t;
    const x = u * u * g.p1[0] + 2 * u * t * g.c[0] + t * t * g.p2[0];
    const y = u * u * g.p1[1] + 2 * u * t * g.c[1] + t * t * g.p2[1];
    const vx = x - prev[0];
    const vy = y - prev[1];
    const l2 = vx * vx + vy * vy || 1;
    const k = Math.max(0, Math.min(1, ((px - prev[0]) * vx + (py - prev[1]) * vy) / l2));
    best = Math.min(best, Math.hypot(px - (prev[0] + vx * k), py - (prev[1] + vy * k)));
    prev = [x, y];
  }
  return best;
}

/** Kartın her kenarında %25 ve %75'te birer bağlama noktası (toplam 8). */
export function handlePoints(r: Rect): Pt[] {
  'worklet';
  return [
    [r.x + r.w * 0.25, r.y],
    [r.x + r.w * 0.75, r.y],
    [r.x + r.w, r.y + r.h * 0.25],
    [r.x + r.w, r.y + r.h * 0.75],
    [r.x + r.w * 0.25, r.y + r.h],
    [r.x + r.w * 0.75, r.y + r.h],
    [r.x, r.y + r.h * 0.25],
    [r.x, r.y + r.h * 0.75],
  ];
}

// ───────────────────────── Sürükleme izi ─────────────────────────

/** Köşeleri yuvarlatılmış dikdörtgenin 8 köşe noktası. */
export function rrect(cx: number, cy: number, w: number, h: number): Pt[] {
  'worklet';
  const r = Math.min(16, w / 2, h / 2);
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const x1 = x0 + w;
  const y1 = y0 + h;
  return [
    [x0 + r, y0],
    [x1 - r, y0],
    [x1, y0 + r],
    [x1, y1 - r],
    [x1 - r, y1],
    [x0 + r, y1],
    [x0, y1 - r],
    [x0, y0 + r],
  ];
}

/** Dışbükey zarf (monotone chain). */
export function hull(P: Pt[]): Pt[] {
  'worklet';
  const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [];
  const up: Pt[] = [];
  for (const p of pts) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
