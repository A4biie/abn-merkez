import { memo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Txt } from '@/components/ui/Txt';
import type { BoardItem } from '@/lib/board';
import { css, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { CardBody } from './CardBodies';
import type { Live } from './live';
import { TINTS } from './tints';

// .bcard { animation: cardIn .35s cubic-bezier(.2,.9,.3,1.2) backwards }
const cardIn = css.keyframes({
  from: { opacity: 0, transform: [{ scale: 0.92 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
});

type Props = {
  item: BoardItem;
  index: number;
  selected: boolean;
  /** Köşe tutamaçları (tek seçili fotoğraf / video / not). */
  resizable?: boolean;
  fading?: boolean;
  editing: boolean;
  /** "Bağla" aracında seçilen ilk kart */
  isFrom: boolean;
  /** Bağlama noktaları gösterilsin mi (seçili, yazılmıyor, düzenleme yetkisi var) */
  canLink: boolean;
  live: Live;
  onHeight: (id: string, h: number) => void;
};

// Kartın kenarlarında %25 ve %75'teki bağlama noktaları (left/top yüzde).
const HANDLES: [`${number}%`, `${number}%`][] = [
  ['25%', '0%'],
  ['75%', '0%'],
  ['100%', '25%'],
  ['100%', '75%'],
  ['25%', '100%'],
  ['75%', '100%'],
  ['0%', '25%'],
  ['0%', '75%'],
];

/** Kart kabı: konum (sürüklerken paylaşılan değerden), seçim halkası, tutamak şeridi, içerik. */
function BoardCardInner({ item, index, selected, resizable, fading, editing, isFrom, canLink, live, onHeight }: Props) {
  const { colors } = useTheme();
  const motion = useMotion();
  const isHeading = item.type === 'heading';
  const isZone = item.type === 'zone';
  const tint = TINTS[item.color];
  const plainBg = isHeading || isZone;
  const tinted = item.type === 'note' || item.type === 'board';
  const bg = plainBg ? 'transparent' : tinted ? colors[tint.bg] : colors.surface;
  const fg = tinted ? colors[tint.fg] : colors.text;
  const baseShadow = plainBg ? 'none' : `0 0 0 1px ${colors.line}, 0 4px 14px rgba(0,0,0,0.08)`;
  const selShadow = `0 0 0 1.5px ${colors.a1}${isZone ? '' : ', 0 12px 30px rgba(0,0,0,0.18)'}`;

  const pos = useAnimatedStyle(() => {
    const did = live.drag.id.get();
    const dragging = did === item.id;
    const inGroup = !!did && !dragging && live.group.get().includes(item.id);
    const gdx = inGroup ? live.drag.x.get() - live.drag.ox.get() : 0;
    const gdy = inGroup ? live.drag.y.get() - live.drag.oy.get() : 0;
    const rz = live.rz.get();
    const rzMe = rz.id === item.id;
    const linkTarget = live.tmp.get().hover === item.id;
    return {
      opacity: withTiming(fading ? 0 : 1, { duration: fading ? 200 : 0 }),
      zIndex: dragging || inGroup ? 60 : selected ? 50 : isZone ? 0 : 2 + index,
      width: rzMe ? rz.w : item.w,
      height: isZone ? (rzMe ? rz.h : (item.h ?? 300)) : rzMe ? rz.h || undefined : (item.h ?? undefined),
      overflow: !isZone && (rzMe ? rz.h : item.h) ? 'hidden' : undefined,
      transform: [
        { translateX: dragging ? live.drag.x.get() : rzMe ? rz.x : item.x + gdx },
        { translateY: dragging ? live.drag.y.get() : rzMe ? rz.y : item.y + gdy },
        { scale: fading ? withTiming(0.85, { duration: 200 }) : withTiming(dragging ? 1.035 : 1, { duration: 220 }) },
        { rotate: withTiming(dragging ? '-1deg' : '0deg', { duration: 220 }) },
      ],
      boxShadow: linkTarget
        ? `0 0 0 3px ${colors.a1}, 0 12px 30px rgba(0,0,0,0.18)`
        : dragging
          ? '0 18px 40px rgba(0,0,0,0.28)'
          : selected || isFrom
            ? selShadow
            : baseShadow,
    };
  });

  // Bağlama noktaları yakınlaştırmadan bağımsız olarak ekranda ~8px görünür.
  const dotStyle = useAnimatedStyle(() => {
    const s = 8 / live.cam.zoom.get();
    return {
      width: s,
      height: s,
      marginLeft: -s / 2,
      marginTop: -s / 2,
      borderRadius: s / 2,
      borderWidth: 1.3 / live.cam.zoom.get(),
    };
  });

  // Boyutlandırma tutamaçları: ekranda sabit 10px, beyaz dolgu, a1 kenar.
  const cornerStyle = useAnimatedStyle(() => {
    const z = live.cam.zoom.get();
    const s = 10 / z;
    return { width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2, borderRadius: s / 2, borderWidth: 1.5 / z };
  });

  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, top: 0, borderRadius: 16, backgroundColor: bg }, pos]}
      onLayout={(e) => onHeight(item.id, e.nativeEvent.layout.height)}
    >
      <Animated.View
        style={[
          { flex: isZone ? 1 : undefined },
          motion.reduced
            ? null
            : {
                animationName: cardIn,
                animationDuration: 350,
                animationTimingFunction: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)',
                animationFillMode: 'backwards',
              },
        ]}
      >
        <Grip visible={selected} color={fg} />
        <CardBody item={item} editing={editing} selected={selected} fg={fg} />
      </Animated.View>

      {isFrom && (
        <View
          style={{
            position: 'absolute',
            top: -12,
            left: 12,
            borderRadius: 999,
            paddingVertical: 2,
            paddingHorizontal: 8,
            backgroundColor: colors.a2,
          }}
        >
          <Txt size={11.5} weight={700} color="a2-ink" leading={1.3}>
            Başlangıç
          </Txt>
        </View>
      )}

      {resizable &&
        CORNERS.map(([left, top], i) => (
          <Animated.View
            key={'c' + i}
            pointerEvents="none"
            style={[
              { position: 'absolute', left, top, zIndex: 4, backgroundColor: '#FFFFFF', borderColor: colors.a1 },
              cornerStyle,
            ]}
          />
        ))}

      {canLink &&
        HANDLES.map(([left, top], i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left,
                top,
                zIndex: 3,
                backgroundColor: colors.a2,
                borderColor: colors.bg,
              },
              dotStyle,
            ]}
          />
        ))}
    </Animated.View>
  );
}

const CORNERS = [
  ['0%', '0%'],
  ['100%', '0%'],
  ['100%', '100%'],
  ['0%', '100%'],
] as const;

export const BoardCard = memo(BoardCardInner);

/** Üstteki sürükleme şeridi (8 nokta). Seçiliyken görünür. */
function Grip({ visible, color }: { visible: boolean; color: string }) {
  return (
    <View style={{ height: 22, alignItems: 'center', justifyContent: 'center', opacity: visible ? 1 : 0 }}>
      <Svg width={28} height={8} viewBox="0 0 28 8" opacity={0.45}>
        {[4, 10, 16, 22].flatMap((cx) => [
          <Circle key={`a${cx}`} cx={cx} cy={2} r={1.6} fill={color} />,
          <Circle key={`b${cx}`} cx={cx} cy={6.5} r={1.6} fill={color} />,
        ])}
      </Svg>
    </View>
  );
}
