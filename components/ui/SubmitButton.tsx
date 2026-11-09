import { useEffect, useRef, useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { LogoLoader } from '@/components/LogoLoader';
import { ease, span } from '@/lib/motion';
import { useTime } from '@/lib/ticker';
import { EASE_OUT, EASE_SPRING, useMotion } from '@/theme/motion';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { GradientFill, useGradient, useHighlight } from './Gradient';
import { Txt } from './Txt';

type State = 'idle' | 'busy' | 'done';

const SIZE = { md: { h: 42, font: 14, px: 18 }, lg: { h: 50, font: 15, px: 20 } } as const;
const CHECK = 'M5 12.5 10 17.5 19 7';
const CHECK_LEN = 21;

/**
 * Gönderme butonu (Paylaş, Gönder, Kaydet). Basınca yazı yukarı kayıp kaybolur, buton 0.45 sn'de
 * daireye daralır ve içinde LogoLoader döner. Başarılıysa a3 rengine dönüp genişler, onay işareti
 * çizilir ve doneLabel yazar; 1.6 sn sonra eski haline döner. Hata olursa titreme yok: buton normale
 * döner, altında kısa bir hata yazısı çıkar.
 *
 * onSubmit: hata varsa Türkçe hata metni, yoksa null döndürür.
 */
export function SubmitButton({
  label,
  doneLabel,
  onSubmit,
  disabled,
  size = 'md',
  block,
  style,
}: {
  label: string;
  doneLabel: string;
  onSubmit: () => Promise<string | null | undefined | void>;
  disabled?: boolean;
  size?: keyof typeof SIZE;
  /** Tam genişlik (panellerde). Daralma yine daireye doğru olur. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const motion = useMotion();
  const s = SIZE[size];
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const [idleW, setIdleW] = useState<number | null>(null);
  const [doneW, setDoneW] = useState<number | null>(null);
  const [blockW, setBlockW] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const t = useTime(state === 'done' && !motion.reduced);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function press() {
    if (state !== 'idle' || disabled) return;
    setError(null);
    setState('busy');
    let result: string | null | undefined | void;
    try {
      result = await onSubmit();
    } catch {
      result = 'Bir şeyler ters gitti. Biraz sonra tekrar dene.';
    }
    if (result) {
      setState('idle');
      setError(result);
      return;
    }
    setState('done');
    timer.current = setTimeout(() => setState('idle'), 1600);
  }

  const full = block ? blockW : null;
  const width = state === 'busy' ? s.h : (full ?? (state === 'done' ? (doneW ?? idleW) : idleW) ?? undefined);
  const bg = state === 'done' ? colors.a3 : disabled ? colors.surface2 : colors.a1;
  const gradient = useGradient('btn');
  const highlight = useHighlight();
  const ink = state === 'done' ? colors['a3-ink'] : disabled ? colors['text-3'] : colors['a1-ink'];
  const checkP = motion.reduced ? 1 : ease.out(span(t, 0, 400));

  const transition = motion.reduced
    ? null
    : motion.transition(['width', 'backgroundColor'], 450, state === 'done' ? EASE_SPRING : EASE_OUT);

  return (
    <View
      style={[
        { gap: 6, alignItems: block ? 'center' : 'flex-start', alignSelf: block ? 'stretch' : undefined },
        style,
      ]}
      onLayout={block ? (e) => setBlockW(Math.floor(e.nativeEvent.layout.width)) : undefined}
    >
      {/* Genişlikleri ölçmek için görünmez kopyalar. */}
      <View
        style={{ position: 'absolute', opacity: 0, flexDirection: 'row' }}
        pointerEvents="none"
        aria-hidden
      >
        <View
          onLayout={(e) => setIdleW(Math.ceil(e.nativeEvent.layout.width))}
          style={{ paddingHorizontal: s.px }}
        >
          <Txt size={s.font} weight={700}>
            {label}
          </Txt>
        </View>
        <View
          onLayout={(e) => setDoneW(Math.ceil(e.nativeEvent.layout.width))}
          style={{ paddingHorizontal: s.px, flexDirection: 'row', gap: 6 }}
        >
          <View style={{ width: 18 }} />
          <Txt size={s.font} weight={700}>
            {doneLabel}
          </Txt>
        </View>
      </View>

      <Animated.View
        style={[
          { width, height: s.h, borderRadius: s.h / 2, backgroundColor: bg, overflow: 'hidden' },
          gradient && state !== 'done' && !disabled && highlight ? { boxShadow: highlight } : null,
          transition,
        ]}
      >
        {gradient && state !== 'done' && !disabled && <GradientFill pair={gradient} />}
        <Pressable
          onPress={press}
          disabled={disabled || state !== 'idle'}
          accessibilityRole="button"
          accessibilityLabel={
            state === 'busy' ? `${label}, gönderiliyor` : state === 'done' ? doneLabel : label
          }
          accessibilityState={{ busy: state === 'busy', disabled: !!disabled }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Animated.Text
            numberOfLines={1}
            style={[
              {
                position: 'absolute',
                fontFamily: fontFamily(700),
                fontSize: s.font,
                color: ink,
                opacity: state === 'idle' ? 1 : 0,
                transform: [{ translateY: state === 'idle' ? 0 : -14 }],
              },
              motion.reduced
                ? null
                : {
                    transitionProperty: ['opacity', 'transform'],
                    transitionDuration: 220,
                    transitionTimingFunction: EASE_OUT,
                  },
            ]}
          >
            {label}
          </Animated.Text>
          {state === 'busy' && (
            <LogoLoader size="sm" color={colors['a1-ink']} label={`${label}, gönderiliyor`} />
          )}
          {state === 'done' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path
                  d={CHECK}
                  fill="none"
                  stroke={ink}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={[CHECK_LEN, CHECK_LEN]}
                  strokeDashoffset={CHECK_LEN * (1 - checkP)}
                />
              </Svg>
              <Txt size={s.font} weight={700} style={{ color: ink }} numberOfLines={1}>
                {doneLabel}
              </Txt>
            </View>
          )}
        </Pressable>
      </Animated.View>
      {!!error && (
        <Txt size={13} color="warn-text" role="alert">
          {error}
        </Txt>
      )}
    </View>
  );
}
