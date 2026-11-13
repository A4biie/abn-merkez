// Wiki sayfa ağacı (design/abn-09.html: .tree). Üst sayfa → alt sayfalar. Webde sürükle bırakla sıralanır ve taşınır:
// satırın üst çeyreğine bırakınca önüne, alt çeyreğine bırakınca arkasına, ortasına bırakınca altına (alt sayfa).

import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { isDescendant, movePage, type WikiPage } from '@/lib/wiki';
import { useTheme } from '@/theme/ThemeProvider';

type Zone = 'before' | 'after' | 'inside';
type Target = { id: string; zone: Zone } | null;

export function WikiTree({ pages, current, onOpen }: { pages: WikiPage[]; current: string | null; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const say = useToast();
  const [drag, setDrag] = useState<string | null>(null);
  const [target, setTarget] = useState<Target>(null);
  const targetRef = useRef<Target>(null);
  const suppress = useRef(false);

  const kids = (parent: string | null) => pages.filter((p) => p.parent_id === parent).sort((a, b) => a.position - b.position);
  const rows: { p: WikiPage; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const p of kids(parent)) {
      rows.push({ p, depth });
      if (depth < 6) walk(p.id, depth + 1);
    }
  };
  walk(null, 0);

  const hit = (x: number, y: number, dragId: string): Target => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-wrow]'))) {
      const r = el.getBoundingClientRect();
      if (y < r.top || y > r.bottom || x < r.left - 20 || x > r.right + 20) continue;
      const id = el.dataset.wrow!;
      if (id === dragId || isDescendant(pages, id, dragId)) return null;
      const f = (y - r.top) / r.height;
      return { id, zone: f < 0.28 ? 'before' : f > 0.72 ? 'after' : 'inside' };
    }
    return null;
  };

  const drop = async (id: string, t: Target) => {
    if (!t) return;
    const over = pages.find((p) => p.id === t.id);
    if (!over) return;
    let parent: string | null;
    let position: number;
    if (t.zone === 'inside') {
      parent = over.id;
      const k = kids(over.id).filter((p) => p.id !== id);
      position = k.length ? k[k.length - 1].position + 1 : 0;
    } else {
      parent = over.parent_id;
      const sib = kids(parent).filter((p) => p.id !== id);
      const i = sib.findIndex((p) => p.id === over.id);
      const prev = t.zone === 'before' ? sib[i - 1] : over;
      const next = t.zone === 'before' ? over : sib[i + 1];
      position = prev && next ? (prev.position + next.position) / 2 : prev ? prev.position + 1 : next ? next.position - 1 : 0;
    }
    try {
      await movePage(id, parent, position);
    } catch {
      say('Sayfa taşınamadı');
    }
  };

  const down = (id: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (Platform.OS !== 'web' || e.button > 0 || e.pointerType !== 'mouse') return;
    const sx = e.clientX;
    const sy = e.clientY;
    let started = false;
    const move = (ev: PointerEvent) => {
      if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      started = true;
      setDrag(id);
      const t = hit(ev.clientX, ev.clientY, id);
      targetRef.current = t;
      setTarget(t);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (started) {
        suppress.current = true;
        setTimeout(() => (suppress.current = false), 0);
        drop(id, targetRef.current);
      }
      setDrag(null);
      setTarget(null);
      targetRef.current = null;
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  const line = <View style={{ height: 3, borderRadius: 3, backgroundColor: colors.a1, marginVertical: -1.5 }} />;

  return (
    <View style={{ gap: 2 }}>
      {rows.map(({ p, depth }) => {
        const on = p.id === current;
        const t = target?.id === p.id ? target.zone : null;
        return (
          <View key={p.id}>
            {t === 'before' && line}
            <View {...({ dataSet: { wrow: p.id }, onPointerDown: down(p.id) } as object)} style={{ opacity: drag === p.id ? 0.4 : 1 }}>
              <Press
                onPress={() => !suppress.current && onOpen(p.id)}
                accessibilityState={{ selected: on }}
                pressScale={1}
                hoverBg="surface"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 7,
                  paddingRight: 10,
                  paddingLeft: 10 + depth * 18,
                  borderRadius: 9,
                  backgroundColor: on ? colors.surface2 : undefined,
                  boxShadow: t === 'inside' ? `inset 0 0 0 2px color-mix(in srgb, ${colors.a1} 55%, transparent)` : undefined,
                }}
              >
                {p.icon ? <Txt size={14}>{p.icon}</Txt> : null}
                <Txt size={14} weight={depth === 0 ? 700 : 600} color={on ? undefined : 'text-2'} numberOfLines={1} style={{ flex: 1 }}>
                  {p.title}
                </Txt>
              </Press>
            </View>
            {t === 'after' && line}
          </View>
        );
      })}
    </View>
  );
}
