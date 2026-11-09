import type { ComponentRef, ReactNode, Ref } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import type { Palette, Token } from '@/theme/themes';
import { Box } from './Box';
import { Icon, type IconName } from './Icon';
import { Press } from './Press';
import { Txt } from './Txt';

/** Token adı ya da sabit renk (prototipte bazı renkler sabit: "#F5C77E"). */
export function paint(colors: Palette, value: Token | string) {
  return value in colors ? colors[value as Token] : value;
}

// ───────────────────────── Buton ─────────────────────────

type ButtonKind = 'primary' | 'accent' | 'cyan' | 'soft' | 'sel' | 'muted';
const KIND: Record<ButtonKind, [Token, Token]> = {
  primary: ['a1', 'a1-ink'],
  accent: ['a2', 'a2-ink'],
  cyan: ['a3', 'a3-ink'],
  soft: ['chip', 'text'],
  sel: ['sel-bg', 'sel-fg'],
  muted: ['surface2', 'text-3'],
};
const SIZE = {
  sm: { py: 7, px: 12, font: 13 },
  md: { py: 10, px: 16, font: 14 },
  lg: { py: 14, px: 18, font: 15 },
};

type ButtonProps = {
  label: string;
  onPress?: () => void;
  kind?: ButtonKind;
  size?: keyof typeof SIZE;
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  /** Prototipte ikincil butonlar 600, ana butonlar 700 kalınlıkta. */
  bold?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  kind = 'primary',
  size = 'md',
  icon,
  iconRight,
  disabled,
  bold,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();
  const [bg, fg] = KIND[kind];
  const s = SIZE[size];
  const weight = bold === undefined ? (kind === 'soft' || kind === 'muted' ? 600 : 700) : bold ? 700 : 600;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      bg={bg}
      hoverBg={kind === 'soft' ? 'hover' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          borderRadius: 999,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={s.font + 2} color={colors[fg]} strokeWidth={2.2} />}
      <Txt size={s.font} weight={weight} color={fg} leading={1.3}>
        {label}
      </Txt>
      {iconRight && <Icon name={iconRight} size={s.font + 2} color={colors[fg]} strokeWidth={2.2} />}
    </Press>
  );
}

/** Yuvarlak ikon butonu (Görev ekle, Süreç paylaş). */
export function IconButton({
  icon,
  onPress,
  label,
  size = 44,
  kind = 'accent',
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  kind?: ButtonKind | 'surface';
}) {
  const { colors } = useTheme();
  const [bg, fg]: [Token, Token] = kind === 'surface' ? ['surface', 'text'] : KIND[kind];
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      bg={bg}
      shadow={kind === 'surface'}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.46)} color={colors[fg]} strokeWidth={2.2} />
    </Press>
  );
}

// ───────────────────────── Etiketler ─────────────────────────

/** Durum etiketi: "Geliştirmede", "Bitti" (12px, 700). */
export function Chip({ label, bg, fg }: { label: string; bg: Token | string; fg: Token | string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: paint(colors, bg),
      }}
    >
      <Txt size={12} weight={700} leading={1.3} style={{ color: paint(colors, fg) }}>
        {label}
      </Txt>
    </View>
  );
}

/** Seçilebilir hap (filtreler, sekmeler). Seçili olan koyu/açık ters renkte. */
export function Pill({
  label,
  active,
  onPress,
  onSheet,
  size = 'md',
  dot,
  suffix,
  style,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Panel içindeyse seçili olmayanın zemini surface2 (prototipteki sheetPill). */
  onSheet?: boolean;
  size?: 'sm' | 'md' | 'lg';
  dot?: string;
  suffix?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const pad = size === 'lg' ? [10, 18, 15] : size === 'sm' ? [7, 12, 13.5] : [9, 15, 14];
  return (
    <Press
      onPress={onPress}
      bg={active ? 'sel-bg' : onSheet ? 'surface2' : 'surface'}
      hoverBg={active ? 'sel-bg' : 'hover'}
      shadow={!onSheet}
      accessibilityState={{ selected: active }}
      style={[
        {
          borderRadius: 999,
          paddingVertical: pad[0],
          paddingHorizontal: pad[1],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
        },
        style,
      ]}
    >
      {dot && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />}
      <Txt size={pad[2]} weight={600} color={active ? 'sel-fg' : 'text-2'} leading={1.3}>
        {label}
      </Txt>
      {!!suffix && (
        <Txt
          size={pad[2]}
          weight={600}
          color={active ? 'sel-fg' : 'text-2'}
          leading={1.3}
          style={{ opacity: 0.7 }}
        >
          {suffix}
        </Txt>
      )}
    </Press>
  );
}

// ───────────────────────── Kart ve başlık ─────────────────────────

export function Card({
  children,
  style,
  radius = 24,
  padding = 16,
  gap = 12,
  bg = 'surface',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  padding?: number;
  gap?: number;
  bg?: Token;
}) {
  return (
    <Box bg={bg} shadow={bg === 'surface'} style={[{ borderRadius: radius, padding, gap }, style]}>
      {children}
    </Box>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Txt size={18} weight={600} leading={1.25} role="heading" style={{ flex: 1 }}>
        {children}
      </Txt>
      {action}
    </View>
  );
}

/** Boş liste kutusu (kesik çizgili çerçeve). */
export function Empty({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors['line-2'],
        borderRadius: 22,
        paddingVertical: 26,
        paddingHorizontal: 18,
      }}
    >
      <Txt color="muted" style={{ textAlign: 'center' }}>
        {children}
      </Txt>
    </View>
  );
}

// ───────────────────────── Metin alanı ─────────────────────────

type FieldProps = TextInputProps & {
  label?: string;
  /** Yorum kutusu gibi tam yuvarlak. */
  round?: boolean;
  minHeight?: number;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

export function Field({ label, round, minHeight, multiline, style, ref, ...rest }: FieldProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      ref={ref}
      aria-label={label}
      placeholderTextColor={colors.faint}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      {...rest}
      style={[
        {
          backgroundColor: colors.surface2,
          borderRadius: round ? 999 : 16,
          paddingVertical: round ? 10 : 12,
          paddingHorizontal: 14,
          color: colors.text,
          fontFamily: fontFamily(400),
          fontSize: 15,
          minHeight,
        },
        style,
      ]}
    />
  );
}
