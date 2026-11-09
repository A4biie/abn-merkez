import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Box } from '@/components/ui/Box';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { THEME_ORDER, THEMES, type ThemeDef } from '@/theme/themes';

const GROUPS: { title: string; scheme: ThemeDef['scheme'] }[] = [
  { title: 'Koyu', scheme: 'dark' },
  { title: 'Açık', scheme: 'light' },
];

/** Temanın küçük önizlemesi: zemin üstünde bir yüzey çubuğu, a1 renginde geniş blok, a2 ve a3 küçük bloklar. */
function Preview({
  t,
  height,
  gap = 6,
  padding = 8,
}: {
  t: ThemeDef;
  height: number;
  gap?: number;
  padding?: number;
}) {
  const { colors } = useTheme();
  const blockH = height - padding * 2 - 10 - gap;
  return (
    <View
      style={{
        height,
        padding,
        gap,
        borderRadius: 12,
        backgroundColor: t.preview.bg,
        borderWidth: 1,
        borderColor: colors['line-2'],
      }}
    >
      <View style={{ height: 10, borderRadius: 5, backgroundColor: t.preview.surface }} />
      <View style={{ flexDirection: 'row', gap: Math.max(3, gap - 2), height: blockH }}>
        <View style={{ flex: 1, borderRadius: 6, backgroundColor: t.preview.a1 }} />
        <View style={{ width: '18%', borderRadius: 6, backgroundColor: t.preview.a2 }} />
        <View style={{ width: '18%', borderRadius: 6, backgroundColor: t.preview.a3 }} />
      </View>
    </View>
  );
}

/** Telefondaki tema sayfası: "Koyu" ve "Açık" grupları, her grupta 2 sütunlu önizleme kartları. */
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
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {THEME_ORDER.filter((k) => THEMES[k].scheme === g.scheme).map((key) => {
              const t = THEMES[key];
              const active = key === name;
              return (
                <Press
                  key={key}
                  onPress={() => setTheme(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, checked: active }}
                  accessibilityLabel={`${t.label} tema, ${t.note}`}
                  bg="surface2"
                  pressScale={0.97}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 18,
                    padding: 10,
                    gap: 8,
                    boxShadow: `0 0 0 2px ${active ? colors['accent-text'] : 'transparent'}`,
                  }}
                >
                  <Preview t={t} height={74} />
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight={700} numberOfLines={1}>
                        {t.label}
                      </Txt>
                      <Txt size={12.5} color="muted" numberOfLines={2}>
                        {t.note}
                      </Txt>
                    </View>
                    {active && (
                      <Animated.View style={motion.spin()}>
                        <Box
                          bg="sel-bg"
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon name="check" size={13} color={colors['sel-fg']} strokeWidth={3} />
                        </Box>
                      </Animated.View>
                    )}
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

/** Sol menünün altındaki 4 tema kutucuğu (bilgisayar). */
export function ThemeTiles() {
  const { name, theme, colors, setTheme } = useTheme();

  return (
    <View style={{ paddingHorizontal: 8, gap: 10 }}>
      <Txt size={11.5} weight={700} color="faint" style={{ letterSpacing: 0.92 }}>
        {`Tema · ${theme.label}`.toLocaleUpperCase('tr')}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {THEME_ORDER.map((key) => {
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
                flex: 1,
                minWidth: 0,
                borderRadius: 12,
                boxShadow: `0 0 0 2px ${colors.nav}, 0 0 0 4px ${active ? colors['accent-text'] : 'transparent'}`,
              }}
            >
              <Preview t={t} height={44} gap={4} padding={5} />
            </Press>
          );
        })}
      </View>
    </View>
  );
}
