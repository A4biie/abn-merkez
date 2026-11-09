import { Easing, withTiming, type SharedValue } from 'react-native-reanimated';

// Board.dc.html: zoom 0.25–2, butonlar 1.2 kat, kamera animasyonu .36s cubic-bezier(.22,1,.36,1).
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
export const ZOOM_STEP = 1.2;
export const CAM_EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const GRID = 26;

export function clampZoom(z: number) {
  'worklet';
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export type Camera = { x: SharedValue<number>; y: SharedValue<number>; zoom: SharedValue<number> };

/** Ekrandaki (px, py) noktası yerinde kalacak şekilde yakınlaştırır. */
export function zoomAt(cam: Camera, nz: number, px: number, py: number, animate = false) {
  'worklet';
  const z = cam.zoom.get();
  const target = clampZoom(nz);
  const wx = (px - cam.x.get()) / z;
  const wy = (py - cam.y.get()) / z;
  const nx = px - wx * target;
  const ny = py - wy * target;
  if (animate) {
    const cfg = { duration: 360, easing: CAM_EASE };
    cam.zoom.set(withTiming(target, cfg));
    cam.x.set(withTiming(nx, cfg));
    cam.y.set(withTiming(ny, cfg));
  } else {
    cam.zoom.set(target);
    cam.x.set(nx);
    cam.y.set(ny);
  }
}

/** Bütün kartları ekrana sığdırır (prototipteki fit: 40px kenar, en fazla %120). */
export function fitTo(
  cam: Camera,
  rects: { x: number; y: number; w: number; h: number }[],
  vpW: number,
  vpH: number,
) {
  const cfg = { duration: 360, easing: CAM_EASE };
  if (!rects.length) {
    cam.zoom.set(withTiming(1, cfg));
    cam.x.set(withTiming(10, cfg));
    cam.y.set(withTiming(10, cfg));
    return;
  }
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  const pad = 40;
  const z = clampZoom(Math.min((vpW - pad * 2) / (x1 - x0), (vpH - pad * 2) / (y1 - y0), 1.2));
  cam.zoom.set(withTiming(z, cfg));
  cam.x.set(withTiming((vpW - (x1 - x0) * z) / 2 - x0 * z, cfg));
  cam.y.set(withTiming((vpH - (y1 - y0) * z) / 2 - y0 * z, cfg));
}
