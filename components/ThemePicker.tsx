// Tema seçici (0.8.0): "Koyu" (5) ve "Açık" (4) grupları. Her kartta temanın gerçek zemini ve üstten
// ışığıyla küçük bir ekran: gradyanlı bir duyuru kartı, bir görev kartı ve bir buton. Gradyanlı
// temalarda küçük bir "gradyan" etiketi var. Önizleme her zaman kendi temasının renklerini kullanır.

import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Box } from '@/components/ui/Box';
import { GlowFill, GradientFill } from '@/components/ui/Gradient';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { THEME_ORDER, THEMES, type GradientPair, type ThemeDef } from '@/theme/themes';

const GROUPS: { title: string; scheme: ThemeDef['scheme'] }[] = [
  { title: 'Koyu', scheme: 'dark' },
  { title: 'Açık', scheme: 'light' },
];

/** Önizlemedeki küçük bir dolgu: gradyanı varsa gradyan, yoksa düz renk. */
function Swatch({
  color,
  pair,
  style,
  children,
}: {
  color: string;
  pair?: GradientPair;
  style: object;
  children?: React.ReactNode;
}) {
  return (
    <View style={[{ backgroundColor: color, overflow: 'hidden' }, style]}>
      {pair && <GradientFill pair={pair} />}
      {children}
    </View>
  );
}

/** Temanın küçük ekranı: zemin + üstten ışık, duyuru kartı (a2), görev kartı (a1) ve bir buton. */
function Preview({ t, height, compact }: { t: ThemeDef; height: number; compact?: boolean }) {
  const { colors } = useTheme();
  const c = t.colors;
  const g = t.gradients;
  const pad = compact ? 5 : 9;
  const bar = (w: number | `${number}%`, color: string, h = compact ? 3 : 5) => (
    <View style={{ width: w, height: h, borderRadius: h, backgroundColor: color, opacity: 0.85 }} />
  );
  return (
    <View
      style={{
        height,
        borderRadius: compact ? 10 : 14,
        backgroundColor: c.bg,
        borderWidth: 1,
        borderColor: colors['line-2'],
        overflow: 'hidden',
        padding: pad,
        gap: compact ? 4 : 6,
      }}
    >
      {g && <GlowFill glow={g.bgGlow} />}
      {/* Duyuru kartı (a2 / annGradient) */}
      <Swatch
        color={c.a2}
        pair={g?.annGradient}
        style={{
          flex: 1.15,
          borderRadius: compact ? 5 : 9,
          padding: compact ? 4 : 7,
          gap: compact ? 2 : 4,
          justifyContent: 'center',
        }}
      >
        {bar('55%', c['a2-ink'])}
        {!compact && bar('80%', c['a2-ink'], 4)}
      </Swatch>
      <View style={{ flex: 1, flexDirection: 'row', gap: compact ? 4 : 6 }}>
        {/* Görev kartı (a1 / taskGradient) */}
        <Swatch
          color={c.a1}
          pair={g?.taskGradient}
          style={{
            flex: 1,
            borderRadius: compact ? 5 : 9,
            padding: compact ? 4 : 7,
            gap: 3,
            justifyContent: 'center',
          }}
        >
          {bar('70%', c['a1-ink'])}
        </Swatch>
        {/* Buton (a1 / btnGradient) */}
        <Swatch
          color={c.a1}
          pair={g?.btnGradient}
          style={{
            width: '38%',
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: g?.highlight,
          }}
        >
          {bar('50%', c['a1-ink'], compact ? 2.5 : 4)}
        </Swatch>
      </View>
    </View>
  );
}

/** Tema sayfası: "Koyu" ve "Açık" grupları, 2 sütunlu önizleme kartları. */
export function ThemeList({ title = true }: { title?: boolean } = {}) {
  const { name, colors, setTheme } = useTheme();
  const motion = useMotion();

  return (
    <View style={{ gap: 16 }}>
      {title && (
        <Txt size={22} weight={700} leading={1.2}>
          Tema
        </Txt>
      )}
      {GROUPS.map((g) => (
        <View key={g.scheme} style={{ gap: 8 }}>
          <Txt size={13} weight={700} color="muted">
            {g.title}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {THEME_ORDER.filter((k) => THEMES[k].scheme === g.scheme).map((key) => {
              const t = THEMES[key];
              const active = key === name;
              return (
                <Press
                  key={key}
                  onPress={() => setTheme(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, checked: active }}
                  accessibilityLabel={`${t.label} tema${t.gradients ? ', gradyanlı' : ''}, ${t.note}`}
                  bg="surface2"
                  pressScale={0.97}
                  style={{
                    flexGrow: 0,
                    flexBasis: '47%',
                    width: '47%',
                    minWidth: 0,
                    borderRadius: 18,
                    padding: 10,
                    gap: 8,
                    boxShadow: `0 0 0 2px ${active ? colors['accent-text'] : 'transparent'}`,
                  }}
                >
                  <View>
                    <Preview t={t} height={92} />
                    {active && (
                      <Animated.View style={[{ position: 'absolute', top: -6, right: -6 }, motion.spin()]}>
                        <Box
                          bg="sel-bg"
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: `0 0 0 3px ${colors.surface2}`,
                          }}
                        >
                          <Icon name="check" size={13} color={colors['sel-fg']} strokeWidth={3} />
                        </Box>
                      </Animated.View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Txt weight={700} numberOfLines={1} style={{ flexShrink: 1 }}>
                          {t.label}
                        </Txt>
                        {t.gradients && (
                          <View
                            style={{
                              borderRadius: 999,
                              paddingVertical: 1,
                              paddingHorizontal: 7,
                              borderWidth: 1,
                              borderColor: colors['line-2'],
                            }}
                          >
                            <Txt size={10.5} weight={800} color="text-3">
                              gradyan
                            </Txt>
                          </View>
                        )}
                      </View>
                      <Txt size={12.5} color="muted" numberOfLines={2}>
                        {t.note}
                      </Txt>
                    </View>
                  </View>
                </Press>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Sol menünün altındaki tema kutucukları (bilgisayar): üstte 5 koyu, altta 4 açık. */
export function ThemeTiles() {
  const { name, theme, colors, setTheme } = useTheme();

  return (
    <View style={{ paddingHorizontal: 8, gap: 10 }}>
      <Txt size={11.5} weight={700} color="faint" style={{ letterSpacing: 0.92 }}>
        {`Tema · ${theme.label}`.toLocaleUpperCase('tr')}
      </Txt>
      {GROUPS.map((g) => (
        <View key={g.scheme} style={{ flexDirection: 'row', gap: 6 }}>
          {THEME_ORDER.filter((k) => THEMES[k].scheme === g.scheme).map((key) => {
            const t = THEMES[key];
            const active = key === name;
            return (
              <Press
                key={key}
                onPress={() => setTheme(key)}
                pressScale={0.95}
                accessibilityRole="radio"
                accessibilityLabel={`${t.label} tema`}
                accessibilityState={{ selected: active, checked: active }}
                // @ts-expect-error title sadece webde fare ipucu olarak çalışır
                title={`${t.label} · ${t.note}`}
                style={{
                  width: '18%',
                  minWidth: 0,
                  borderRadius: 10,
                  boxShadow: `0 0 0 2px ${colors.nav}, 0 0 0 4px ${active ? colors['accent-text'] : 'transparent'}`,
                }}
              >
                <Preview t={t} height={40} compact />
              </Press>
            );
          })}
        </View>
      ))}
    </View>
  );
}
