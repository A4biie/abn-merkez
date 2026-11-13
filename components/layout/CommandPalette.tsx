// Ctrl+K / Cmd+K komut paleti (0.11 bölüm 1, design/abn-09.html: .pal). Üst ortada açılır, arkası kararıp bulanıklaşır.
// Boşken İşlemler + Sayfalar; yazınca görevler, kişiler (sonraki bölümlerde buglar, wiki, dosyalar) arasında arar.
// Arama istemcideki önbellekten yapılır (istek atılmaz), yazım 80 ms debounce'lanır. Telefonda tam ekran.

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { useActions } from '@/components/sheets/ActionsProvider';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { TASK_STATUS } from '@/lib/labels';
import { closePalette, fold, togglePalette, usePaletteOpen } from '@/lib/palette';
import { openProfile } from '@/lib/profileModal';
import { useProfiles, useTasks } from '@/lib/queries';
import { THEMES, type ThemeName } from '@/theme/themes';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { TABS } from './nav';

const SPRING = 'cubic-bezier(0.2, 1.25, 0.35, 1)';
const mIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.97 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const mOut = css.keyframes({
  from: { opacity: 1, transform: [{ scale: 1 }] },
  to: { opacity: 0, transform: [{ scale: 0.98 }] },
});
const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const fadeOut = css.keyframes({ from: { opacity: 1 }, to: { opacity: 0 } });

export type PaletteItem = { group: string; icon: string; label: string; info: string; run: () => void };

/** Klavye kısayolu her ekrandan; palet açık / kapalı durumunu izler. */
export function CommandPalette() {
  const open = usePaletteOpen();
  const [shown, setShown] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setShown(true);
  }
  const closing = shown && !open;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // Kapanış animasyonu (0.15 sn) bitince bileşen kalkar.
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setShown(false), 150);
    return () => clearTimeout(t);
  }, [closing]);

  if (!shown) return null;
  return <Palette closing={closing} />;
}

function Palette({ closing }: { closing: boolean }) {
  const { colors, theme, setTheme } = useTheme();
  const motion = useMotion();
  const say = useToast();
  const { openAddTask } = useActions();
  const tasks = useTasks();
  const people = useProfiles();
  const { width } = useWindowDimensions();
  const full = width < 700;
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDq(q), 80);
    return () => clearTimeout(t);
  }, [q]);

  const all = useMemo<PaletteItem[]>(() => {
    const it: PaletteItem[] = [
      { group: 'İşlemler', icon: '➕', label: 'Yeni görev', info: 'Görev', run: () => openAddTask() },
      { group: 'İşlemler', icon: '💡', label: 'Yeni fikir', info: 'Fikir', run: () => router.navigate({ pathname: '/fikirler', params: { yeni: '1' } }) },
      {
        group: 'İşlemler',
        icon: '🎨',
        label: 'Temayı değiştir',
        info: 'Tema',
        run: () => {
          const keys = Object.keys(THEMES) as ThemeName[];
          const cur = keys.findIndex((k) => THEMES[k] === theme);
          const next = keys[(cur + 1) % keys.length];
          setTheme(next);
          say('Tema: ' + THEMES[next].label);
        },
      },
      ...TABS.map((t) => ({ group: 'Sayfalar', icon: '↪', label: t.label, info: 'Git', run: () => router.navigate(t.href) })),
    ];
    for (const t of tasks.data ?? [])
      it.push({
        group: 'Görevler',
        icon: '☑',
        label: t.title,
        info: TASK_STATUS[t.status].label,
        run: () => router.navigate({ pathname: '/gorevler', params: { sekme: 'tumu', vurgu: t.id } }),
      });
    for (const p of people.data ?? [])
      it.push({ group: 'Kişiler', icon: '👤', label: p.full_name || '@' + p.username, info: 'Profil', run: () => openProfile(p.id) });
    return it;
  }, [tasks.data, people.data, theme, setTheme, openAddTask, say]);

  const s = fold(dq.trim());
  const results = useMemo(
    () =>
      s
        ? all.filter((i) => fold(i.label + ' ' + i.group + ' ' + i.info).includes(s)).slice(0, 30)
        : all.filter((i) => i.group === 'İşlemler' || i.group === 'Sayfalar').slice(0, 10),
    [all, s],
  );
  const cur = Math.min(sel, Math.max(0, results.length - 1));

  const run = (i: PaletteItem | undefined) => {
    if (!i) return;
    closePalette();
    setTimeout(i.run, 0);
  };
  const create = () => {
    const title = q.trim();
    closePalette();
    setTimeout(() => openAddTask({ title } as never), 0);
  };

  const onKey = (e: { key: string; preventDefault: () => void }) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((cur + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((cur - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length) run(results[cur]);
      else if (q.trim()) create();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  };

  // Seçili satır görünür kalsın.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.querySelector('[data-pal-sel="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [cur, results]);

  const anim = motion.reduced
    ? { animationName: closing ? fadeOut : fadeIn, animationDuration: closing ? 120 : 150 }
    : { animationName: closing ? mOut : mIn, animationDuration: closing ? 150 : 220, animationTimingFunction: closing ? 'ease' : SPRING };

  let lastGroup = '';
  return (
    <Animated.View
      style={[
        {
          position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
          inset: 0,
          zIndex: 1100,
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: full ? 0 : 70,
          paddingHorizontal: full ? 0 : 20,
          backgroundColor: 'rgba(0,0,0,0.55)',
          animationName: closing ? fadeOut : fadeIn,
          animationDuration: closing ? 150 : 180,
          animationFillMode: 'both',
        },
        Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as object) : null,
      ]}
    >
      <Press onPress={closePalette} accessibilityLabel="Kapat" pressScale={1} style={{ position: 'absolute', inset: 0 } as object} />
      <Animated.View
        role="dialog"
        aria-label="Komut paleti"
        style={[
          {
            width: '100%',
            maxWidth: full ? undefined : 600,
            maxHeight: full ? '100%' : 470,
            height: full ? '100%' : undefined,
            borderRadius: full ? 0 : 18,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            boxShadow: `0 0 0 1px ${colors.line}, 0 24px 60px rgba(0,0,0,.45)`,
            animationFillMode: 'both',
          },
          anim,
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Txt size={16} color="muted">
            ⌕
          </Txt>
          <TextInput
            autoFocus
            value={q}
            onChangeText={(v) => {
              setQ(v);
              setSel(0);
            }}
            onKeyPress={onKey as never}
            placeholder="Görev, bug, kişi, wiki, dosya ara ya da komut yaz…"
            placeholderTextColor={colors.muted}
            aria-label="Ara"
            autoComplete="off"
            style={[{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600', color: colors.text, fontFamily: 'Urbanist' }, { outlineStyle: 'none' } as object]}
          />
          {full ? (
            <Press onPress={closePalette} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              <Txt size={14} weight={800}>
                Kapat
              </Txt>
            </Press>
          ) : (
            <Kbd>Esc</Kbd>
          )}
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 6 }} keyboardShouldPersistTaps="handled">
          {results.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
              <Txt color="muted">&quot;{q}&quot; için sonuç yok.</Txt>
              {q.trim() ? (
                <Press onPress={create} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.chip }}>
                  <Txt size={13} weight={800}>
                    + &quot;{q.trim()}&quot; adında görev oluştur
                  </Txt>
                </Press>
              ) : null}
            </View>
          ) : (
            results.map((i, k) => {
              const head = i.group !== lastGroup ? i.group : null;
              lastGroup = i.group;
              const on = k === cur;
              return (
                <View key={i.group + k + i.label}>
                  {head && (
                    <Txt size={11} weight={800} color="muted" style={{ letterSpacing: 0.88, textTransform: 'uppercase', paddingTop: 10, paddingHorizontal: 10, paddingBottom: 4 }}>
                      {head}
                    </Txt>
                  )}
                  <Press
                    onPress={() => run(i)}
                    onHoverIn={() => setSel(k)}
                    role="option"
                    aria-selected={on}
                    {...({ dataSet: { palSel: on ? '1' : '0' } } as object)}
                    pressScale={1}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 9,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: on ? `color-mix(in srgb, ${colors.a1} 18%, transparent)` : undefined,
                    }}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                      <Txt size={14}>{i.icon}</Txt>
                    </View>
                    <Txt size={14} weight={700} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
                      <Highlight text={i.label} q={s} />
                    </Txt>
                    <Txt size={12.5} weight={600} color="muted" numberOfLines={1}>
                      {i.info}
                    </Txt>
                  </Press>
                </View>
              );
            })
          )}
        </ScrollView>
        {!full && (
          <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 9, paddingHorizontal: 16, borderTopWidth: 1, borderColor: colors.line }}>
            <Txt size={12} color="muted">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> seç
            </Txt>
            <Txt size={12} color="muted">
              <Kbd>Enter</Kbd> aç
            </Txt>
            <Txt size={12} color="muted">
              <Kbd>Esc</Kbd> kapat
            </Txt>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

/** Eşleşen kısım a1 renginde. Karşılaştırma fold()'la, kesme orijinal metinden (karakter karakter). */
function Highlight({ text, q }: { text: string; q: string }) {
  const { colors } = useTheme();
  if (!q) return <>{text}</>;
  const chars = Array.from(text);
  const f = chars.map((c) => fold(c)).join('');
  const i = f.indexOf(q);
  if (i < 0 || f.length !== chars.length) return <>{text}</>;
  return (
    <>
      {chars.slice(0, i).join('')}
      <Txt size={14} weight={700} style={{ color: colors.a1 }}>
        {chars.slice(i, i + Array.from(q).length).join('')}
      </Txt>
      {chars.slice(i + Array.from(q).length).join('')}
    </>
  );
}

export function Kbd({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Txt
      size={11}
      color="muted"
      style={{
        fontFamily: 'JetBrains Mono, ui-monospace, Consolas, monospace',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        backgroundColor: colors.chip,
        marginHorizontal: 1,
      }}
    >
      {children}
    </Txt>
  );
}
