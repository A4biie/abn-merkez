// Ortak animasyon saati: tek bir requestAnimationFrame döngüsü, ona abone olan bileşenler.
// SVG özelliklerini (çizgi ofseti, dönüşüm) zamana göre çizen bileşenler bunu kullanır; webde
// Reanimated SVG özelliklerini güncelleyemediği için bu animasyonlar JS'te hesaplanır.

import { useEffect, useState } from 'react';

type Listener = (now: number) => void;
const listeners = new Set<Listener>();
let raf: number | null = null;

function loop(now: number) {
  listeners.forEach((l) => l(now));
  raf = listeners.size ? requestAnimationFrame(loop) : null;
}

function subscribe(l: Listener) {
  listeners.add(l);
  if (raf === null) raf = requestAnimationFrame(loop);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Bileşen göründüğünden beri geçen süre (ms). active false iken durur ve 0 döner.
 * Her karede yeniden çizer; sadece küçük SVG'ler için kullan.
 */
export function useTime(active = true) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    const unsub = subscribe((now) => {
      if (start === null) start = now;
      setT(now - start);
    });
    return () => {
      unsub();
      setT(0);
    };
  }, [active]);
  return active ? t : 0;
}
