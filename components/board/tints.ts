import type { Tint } from '@/lib/board';
import type { Palette, Token } from '@/theme/themes';

/** Board.dc.html TINTS: kart zemini, yazı rengi, etiket. */
export const TINTS: Record<Tint, { bg: Token; fg: Token; label: string }> = {
  surface: { bg: 'surface', fg: 'text', label: 'Düz' },
  a1: { bg: 'a1', fg: 'a1-ink', label: 'Tema rengi 1' },
  a2: { bg: 'a2', fg: 'a2-ink', label: 'Tema rengi 2' },
  a3: { bg: 'a3', fg: 'a3-ink', label: 'Tema rengi 3' },
};

export const TINT_ORDER: Tint[] = ['surface', 'a1', 'a2', 'a3'];

/** Seçim halkalarında "Düz" seçeneği surface2 ile gösterilir (prototipteki newTints). */
export function swatch(colors: Palette, t: Tint) {
  return t === 'surface' ? colors.surface2 : colors[TINTS[t].bg];
}
