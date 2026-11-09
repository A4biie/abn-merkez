import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Box } from '@/components/ui/Box';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';
import type { Milestone, Project } from '@/lib/types';
import { css, EASE_OUT, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

const grow = css.keyframes({ from: { transform: [{ scaleX: 0 }] }, to: { transform: [{ scaleX: 1 }] } });

/** İlerleme çubuğu (.bar: soldan büyüyerek dolar). */
export function ProgressBar({ pct }: { pct: number }) {
  const { colors } = useTheme();
  const motion = useMotion();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Box bg="chip" style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' }}>
        <Animated.View
          style={[
            { width: `${pct}%`, height: 8, borderRadius: 4, transformOrigin: 'left', backgroundColor: colors.bar },
            motion.colors,
            motion.reduced
              ? null
              : {
                  animationName: grow,
                  animationDuration: 900,
                  animationDelay: 200,
                  animationTimingFunction: EASE_OUT,
                  animationFillMode: 'both',
                },
          ]}
        />
      </Box>
      <Txt size={13} weight={700} style={{ fontVariant: ['tabular-nums'] }}>
        %{pct}
      </Txt>
    </View>
  );
}

export function nextStep(project: Project) {
  return project.milestones.find((m) => !m.done)?.title ?? 'Tamamlandı';
}

/** Kilometre taşları. Telefonda dikey zaman çizelgesi, bilgisayarda yatay. */
export function Milestones({ items, horizontal }: { items: Milestone[]; horizontal?: boolean }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const firstOpen = items.findIndex((m) => !m.done);

  if (items.length === 0) {
    return (
      <Txt size={14} color="muted">
        Henüz kilometre taşı eklenmedi.
      </Txt>
    );
  }

  const dot = (m: Milestone, i: number) => {
    const current = i === firstOpen;
    const size = horizontal ? 24 : 22;
    return (
      <View style={{ width: size, height: size }}>
        {current && (
          <Animated.View
            style={[
              { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: colors.a2 },
              motion.ring(),
            ]}
          />
        )}
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2.5,
            borderColor: m.done ? colors.a1 : current ? colors.a2 : colors['line-2'],
            backgroundColor: m.done ? colors.a1 : colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {m.done && <Icon name="check" size={12} color={colors['a1-ink']} strokeWidth={3.2} />}
        </View>
      </View>
    );
  };

  const label = (m: Milestone, i: number, size: number) => (
    <>
      <Txt size={size} weight={600} color={m.done || i === firstOpen ? 'text' : 'faint'}>
        {m.title}
      </Txt>
      {i === firstOpen && (
        <Txt size={horizontal ? 12 : 12.5} weight={600} color="lilac-text">
          Şu an burada
        </Txt>
      )}
    </>
  );

  if (horizontal) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {items.map((m, i) => (
          <View key={m.id} style={{ flexGrow: 1, flexBasis: 120, minWidth: 110, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {dot(m, i)}
              {i < items.length - 1 && (
                <View style={{ flex: 1, height: 2, backgroundColor: m.done ? colors.a1 : colors['line-2'] }} />
              )}
            </View>
            <View style={{ paddingRight: 10 }}>{label(m, i, 14)}</View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      {items.map((m, i) => (
        <View key={m.id} style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ alignItems: 'center', width: 24 }}>
            {dot(m, i)}
            {i < items.length - 1 && <View style={{ width: 2, flex: 1, minHeight: 20, backgroundColor: colors['line-2'] }} />}
          </View>
          <View style={{ paddingBottom: 14, flex: 1 }}>{label(m, i, 15)}</View>
        </View>
      ))}
    </View>
  );
}
