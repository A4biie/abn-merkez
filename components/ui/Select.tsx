import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { EASE_BOUNCE, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { Press } from './Press';
import { Sheet } from './Sheet';
import { Txt } from './Txt';

/** Açılır seçim (prototipteki <select>): basınca seçenekler panelde listelenir. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  minWidth = 150,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  minWidth?: number;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? '—';
  return (
    <>
      <Press
        onPress={() => setOpen(true)}
        accessibilityLabel={`${label}: ${current}`}
        bg="surface2"
        border="line-2"
        pressScale={0.98}
        style={{ minWidth, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Txt size={14} style={{ flex: 1 }} numberOfLines={1}>
          {current}
        </Txt>
        <View style={{ transform: [{ rotate: '90deg' }] }}>
          <Icon name="chevron" size={14} color={colors.muted} strokeWidth={2.2} />
        </View>
      </Press>
      <Sheet open={open} onClose={() => setOpen(false)} label={label}>
        <Txt size={20} weight={700}>
          {label}
        </Txt>
        <View style={{ gap: 6 }}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <Press
                key={o.value}
                onPress={() => {
                  setOpen(false);
                  if (!on) onChange(o.value);
                }}
                bg={on ? 'sel-bg' : 'surface2'}
                hoverBg={on ? 'sel-bg' : 'hover'}
                accessibilityState={{ selected: on }}
                style={{ borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}
              >
                <Txt weight={600} color={on ? 'sel-fg' : 'text'} style={{ flex: 1 }}>
                  {o.label}
                </Txt>
                {on && <Icon name="check" size={18} color={colors['sel-fg']} strokeWidth={2.6} />}
              </Press>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

/** Açık/kapalı anahtarı (prototipteki role="switch"). */
export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { colors } = useTheme();
  const motion = useMotion();
  return (
    <Press
      onPress={() => onChange(!value)}
      role="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      pressScale={0.96}
      style={{ width: 46, height: 26, borderRadius: 13, backgroundColor: value ? colors.a2 : colors.chip }}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: 3, left: value ? 23 : 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
          motion.transition('left', 400, EASE_BOUNCE),
        ]}
      />
    </Press>
  );
}
