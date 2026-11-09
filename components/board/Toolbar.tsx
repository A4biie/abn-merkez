import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Box } from '@/components/ui/Box';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Stagger } from '@/components/ui/Stagger';
import { Txt } from '@/components/ui/Txt';
import type { Cap, ItemType } from '@/lib/board';
import { css, EASE_OUT, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import type { Token } from '@/theme/themes';

export type Tool = ItemType | 'connect' | 'upload';

// Board.dc.html TOOLS ve MORE_TOOLS
const TOOLS: [Tool, string, IconName][] = [
  ['note', 'Not', 'note'],
  ['todo', 'Yapılacak', 'todo'],
  ['image', 'Görsel', 'image'],
  ['color', 'Renk', 'palette'],
  ['link', 'Link', 'link'],
  ['board', 'Pano', 'pano'],
  ['heading', 'Başlık', 'heading'],
  ['connect', 'Bağla', 'connect'],
  ['upload', 'Yükle', 'upload'],
];
const MORE_TOOLS: [ItemType, string, IconName, Token, Token][] = [
  ['zone', 'Bölge', 'zone', 'a2', 'a2-ink'],
  ['sketch', 'Çizim', 'sketch', 'a1', 'a1-ink'],
  ['table', 'Tablo', 'table', 'a3', 'a3-ink'],
  ['quote', 'Alıntı', 'quote', 'a2', 'a2-ink'],
  ['file', 'Dosya', 'file', 'a3', 'a3-ink'],
  ['video', 'Video', 'video', 'a1', 'a1-ink'],
];

const pop = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.96 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});

function usePop() {
  const motion = useMotion();
  return motion.reduced
    ? null
    : ({
        animationName: pop,
        animationDuration: 320,
        animationTimingFunction: EASE_OUT,
        animationFillMode: 'both',
      } as const);
}

const panelShadow = '0 16px 40px rgba(0,0,0,0.25)';

/**
 * Yüzen araç çubuğu: telefonda alttan biraz yukarıda yatay, bilgisayarda solda dikey; köşeleri
 * yuvarlak, ekrana yapışık değil. Sonda sabit "Daha fazla" butonu.
 */
export function Toolbar({
  compact,
  connecting,
  moreOpen,
  onTool,
  onToggleMore,
}: {
  compact: boolean;
  connecting: boolean;
  moreOpen: boolean;
  onTool: (t: Tool) => void;
  onToggleMore: () => void;
}) {
  const { colors } = useTheme();
  const motion = useMotion();
  const btnW = compact ? 58 : 64;
  const iconS = compact ? 32 : 34;

  const button = (
    key: string,
    label: string,
    icon: React.ReactNode,
    on: boolean,
    onPress: () => void,
    extra?: object,
  ) => (
    <Press
      key={key}
      onPress={onPress}
      hoverBg={on ? 'nav-pill' : 'hover'}
      bg={on ? 'nav-pill' : undefined}
      pressScale={0.95}
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={[
        {
          width: btnW,
          borderRadius: 16,
          paddingTop: 6,
          paddingBottom: 5,
          paddingHorizontal: 2,
          alignItems: 'center',
          gap: 3,
        },
        extra,
      ]}
    >
      {icon}
      <Txt size={11} weight={600} color={on ? 'accent-text' : 'text-2'} leading={1.2} numberOfLines={1}>
        {label}
      </Txt>
    </Press>
  );

  return (
    <View
      pointerEvents="box-none"
      style={
        compact
          ? { position: 'absolute', left: 10, right: 10, bottom: 14 }
          : { position: 'absolute', left: 12, top: 12, bottom: 12 }
      }
    >
      <Box
        bg="nav"
        border="line"
        role="toolbar"
        aria-label="Pano araçları"
        style={{
          flexDirection: compact ? 'row' : 'column',
          alignItems: 'center',
          gap: 2,
          padding: 6,
          borderRadius: 24,
          boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
          alignSelf: compact ? 'stretch' : 'flex-start',
          maxHeight: compact ? undefined : '100%',
        }}
      >
        <ScrollView
          horizontal={compact}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ flexDirection: compact ? 'row' : 'column', alignItems: 'center', gap: 2 }}
        >
          {TOOLS.map(([t, label, icon]) => {
            const on = t === 'connect' && connecting;
            return button(
              t,
              label,
              <View
                style={{
                  width: iconS,
                  height: iconS,
                  borderRadius: 10,
                  backgroundColor: on ? colors.a2 : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={icon} size={17} color={on ? colors['a2-ink'] : colors.text} strokeWidth={1.9} />
              </View>,
              on,
              () => onTool(t),
            );
          })}
        </ScrollView>
        <View
          style={
            compact
              ? {
                  width: 2,
                  height: 36,
                  marginHorizontal: 4,
                  backgroundColor: colors['line-2'],
                  borderRadius: 2,
                }
              : {
                  width: 36,
                  height: 2,
                  marginVertical: 4,
                  backgroundColor: colors['line-2'],
                  borderRadius: 2,
                }
          }
        />
        {button(
          'more',
          'Daha fazla',
          <View
            style={{
              width: iconS,
              height: iconS,
              borderRadius: 10,
              backgroundColor: colors.a1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Animated.View
              style={[
                { transform: [{ rotate: moreOpen ? '45deg' : '0deg' }] },
                motion.transition('transform', 250),
              ]}
            >
              <Icon name="plus" size={17} color={colors['a1-ink']} strokeWidth={2.4} />
            </Animated.View>
          </View>,
          moreOpen,
          onToggleMore,
        )}
      </Box>
    </View>
  );
}

/** "Daha fazla ekle" paneli: Bölge, Çizim, Tablo, Alıntı, Dosya, Video. */
export function MorePanel({
  compact,
  onPick,
  onClose,
}: {
  compact: boolean;
  onPick: (t: ItemType) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const popStyle = usePop();
  return (
    <Animated.View
      role="menu"
      aria-label="Daha fazla araç"
      style={[
        compact
          ? { position: 'absolute', left: 10, right: 10, bottom: 100 }
          : { position: 'absolute', left: 100, top: 12, width: 300 },
        {
          zIndex: 21,
          backgroundColor: colors.nav,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 24,
          padding: 12,
          gap: 10,
          boxShadow: panelShadow,
        },
        popStyle,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Txt weight={800} style={{ flex: 1 }}>
          Daha fazla ekle
        </Txt>
        <Press
          onPress={onClose}
          accessibilityLabel="Kapat"
          hoverBg="hover"
          style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" size={16} color={colors.muted} strokeWidth={2.2} />
        </Press>
      </View>
      <Stagger style={{ flexDirection: 'row', flexWrap: 'wrap' }} gap={6}>
        {MORE_TOOLS.map(([t, label, icon, bg, fg]) => (
          <Press
            key={t}
            onPress={() => onPick(t)}
            role="menuitem"
            bg="surface"
            hoverBg="hover"
            style={{
              width: compact ? undefined : 86,
              flexGrow: 1,
              flexBasis: '30%',
              borderRadius: 16,
              paddingTop: 10,
              paddingBottom: 8,
              paddingHorizontal: 4,
              alignItems: 'center',
              gap: 6,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: colors[bg],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={icon} size={19} color={colors[fg]} strokeWidth={1.9} />
            </View>
            <Txt size={12} weight={600} color="text-2">
              {label}
            </Txt>
          </Press>
        ))}
      </Stagger>
    </Animated.View>
  );
}

// Board.dc.html HELP: [başlık, telefon metni, bilgisayar metni, ikon yolu]
const HELP: [string, string, string, string][] = [
  [
    'Ekle.',
    'Alttaki araçlardan kart ekle. Bölge, çizim, tablo gibi diğerleri Daha fazla içinde.',
    'Soldaki araçlardan kart ekle. Bölge, çizim, tablo gibi diğerleri Daha fazla içinde.',
    'M12 5v14M5 12h14',
  ],
  [
    'Taşı.',
    'Kartı her yerinden basılı tutup sürükle.',
    'Kartı her yerinden tutup sürükle.',
    'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  ],
  [
    'Düzenle.',
    'Kartı seç, sonra bir kez daha dokunup yazmaya başla.',
    'Kartı seç, sonra bir kez daha tıklayıp yazmaya başla.',
    'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  ],
  [
    'Gezin.',
    'Boş alanı sürükleyerek her yöne git, iki parmakla yakınlaştır.',
    'Boş alanı sürükle ya da tekerlekle kaydır. Ctrl + tekerlek yakınlaştırır.',
    'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  ],
  [
    'Bağla.',
    'Kartın kenarındaki küçük noktalardan birini başka bir karta sürükle.',
    'Kartın kenarındaki küçük noktalardan birini başka bir karta sürükle.',
    'M5 19L19 5M14 5h5v5',
  ],
  [
    'Bağlantıyı düzenle.',
    'Bağlantıya dokun: ortadaki noktayla eğ, uçlarını başka karta taşı, menüden ok ya da nokta seç.',
    'Bağlantıya tıkla: ortadaki noktayla eğ, uçlarını başka karta taşı, menüden ok ya da nokta seç.',
    'M4 18C8 6 16 18 20 6',
  ],
  [
    'Pano içinde pano.',
    'Pano kartındaki Aç ile içine gir, üstteki Panolar ile listeye dön.',
    'Pano kartına çift tıkla ya da Aç de. Üstteki Panolar ile listeye dön.',
    'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  ],
];

/** Sağ üstte daire içinde "i". Basınca 7 adımlık rehber açılır; kullanım yazısı ekranda sürekli durmaz. */
export function HelpButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  return (
    <Press
      onPress={onToggle}
      accessibilityLabel="Nasıl kullanılır"
      accessibilityState={{ expanded: open }}
      bg={open ? 'sel-bg' : 'nav'}
      pressScale={0.92}
      style={{
        position: 'absolute',
        zIndex: 22,
        right: 12,
        top: 12,
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.5,
        borderColor: open ? colors['sel-bg'] : colors['line-2'],
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(0,0,0,0.14)',
      }}
    >
      <Icon name="info" size={14} color={open ? colors['sel-fg'] : colors['text-2']} strokeWidth={2.8} />
    </Press>
  );
}

export function HelpPanel({ compact, onClose }: { compact: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const popStyle = usePop();
  const tones: [Token, Token][] = [
    ['a1', 'a1-ink'],
    ['a2', 'a2-ink'],
    ['a3', 'a3-ink'],
  ];
  return (
    <Animated.View
      role="dialog"
      aria-label="Pano nasıl kullanılır"
      style={[
        compact
          ? { position: 'absolute', left: 10, right: 10, top: 52, maxHeight: '75%' }
          : { position: 'absolute', right: 12, top: 52, width: 330, maxHeight: '90%' },
        {
          zIndex: 23,
          backgroundColor: colors.nav,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 22,
          paddingTop: 14,
          paddingHorizontal: 14,
          paddingBottom: 10,
          boxShadow: panelShadow,
          transformOrigin: 'top right',
        },
        popStyle,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Txt size={16} weight={800} style={{ flex: 1 }}>
          Pano nasıl kullanılır
        </Txt>
        <Press
          onPress={onClose}
          accessibilityLabel="Kapat"
          hoverBg="hover"
          style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" size={16} color={colors.muted} strokeWidth={2.2} />
        </Press>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Stagger gap={2}>
          {HELP.map(([t, phone, desk, icon], i) => {
            const [bg, fg] = tones[i % 3];
            return (
              <View
                key={t}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'flex-start',
                  paddingVertical: 7,
                  paddingHorizontal: 4,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    backgroundColor: colors[bg],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path
                      d={icon}
                      stroke={colors[fg]}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Txt size={13.5} color="text-2" style={{ flex: 1, minWidth: 0 }} leading={1.4}>
                  <Txt size={13.5} weight={800} leading={1.4}>
                    {t}
                  </Txt>{' '}
                  {compact ? phone : desk}
                </Txt>
              </View>
            );
          })}
        </Stagger>
      </ScrollView>
    </Animated.View>
  );
}

// Board.dc.html CAP_ICON: uç tipi simgeleri (28x14)
const CAP_ICON: Record<'s' | 'e', Record<Cap, [string, string]>> = {
  s: {
    none: ['M3 7H25', ''],
    dot: ['M9 7H25', 'M2 7a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0'],
    arrow: ['M10 7H25', 'M2 7L11 2.5V11.5Z'],
  },
  e: {
    none: ['M3 7H25', ''],
    dot: ['M3 7H19', 'M19 7a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0'],
    arrow: ['M3 7H18', 'M26 7L17 2.5V11.5Z'],
  },
};
const CAP_LABEL: Record<Cap, string> = { none: 'Uç yok', dot: 'Nokta', arrow: 'Ok' };

/** Seçili bağlantının menüsü: baş/uç tipi, düzleştir, kesikli, yön çevir, sil. */
export function LinkMenu({
  compact,
  start,
  end,
  dashed,
  bent,
  onCap,
  onStraighten,
  onDash,
  onFlip,
  onDelete,
}: {
  compact: boolean;
  start: Cap;
  end: Cap;
  dashed: boolean;
  bent: boolean;
  onCap: (side: 's' | 'e', c: Cap) => void;
  onStraighten: () => void;
  onDash: () => void;
  onFlip: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const popStyle = usePop();

  const caps = (side: 's' | 'e', cur: Cap) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Txt size={12} weight={700} color="muted">
        {side === 's' ? 'Baş' : 'Uç'}
      </Txt>
      <View
        style={{
          flexDirection: 'row',
          gap: 2,
          backgroundColor: colors.surface2,
          borderRadius: 999,
          padding: 3,
        }}
      >
        {(['none', 'dot', 'arrow'] as Cap[]).map((k) => {
          const on = cur === k;
          const [line, cap] = CAP_ICON[side][k];
          const fg = on ? colors['sel-fg'] : colors['text-2'];
          return (
            <Press
              key={k}
              onPress={() => onCap(side, k)}
              accessibilityLabel={`${side === 's' ? 'Başlangıç' : 'Bitiş'}: ${CAP_LABEL[k]}`}
              accessibilityState={{ selected: on }}
              bg={on ? 'sel-bg' : undefined}
              style={{
                width: 40,
                height: 28,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={28} height={14} viewBox="0 0 28 14">
                <Path d={line} stroke={fg} strokeWidth={2} strokeLinecap="round" />
                {!!cap && <Path d={cap} fill={fg} />}
              </Svg>
            </Press>
          );
        })}
      </View>
    </View>
  );

  const round = (label: string, icon: IconName, onPress: () => void) => (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      bg="surface2"
      hoverBg="hover"
      style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={16} color={colors.text} strokeWidth={2.2} />
    </Press>
  );

  return (
    <Animated.View
      style={[
        compact
          ? { position: 'absolute', left: 10, right: 10, bottom: 100, justifyContent: 'center' }
          : { position: 'absolute', left: 100, top: 12 },
        {
          zIndex: 21,
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          paddingVertical: 8,
          paddingHorizontal: 10,
          backgroundColor: colors.nav,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 20,
          boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
        },
        popStyle,
      ]}
    >
      {caps('s', start)}
      {caps('e', end)}
      {bent ? (
        <Press
          onPress={onStraighten}
          bg="surface2"
          style={{ height: 34, borderRadius: 999, paddingHorizontal: 12, justifyContent: 'center' }}
        >
          <Txt size={12.5} weight={700}>
            Düzleştir
          </Txt>
        </Press>
      ) : (
        <Txt size={12} color="muted" style={{ maxWidth: 150 }} leading={1.3}>
          Ortadaki noktayı sürükleyerek eğ
        </Txt>
      )}
      <Press
        onPress={onDash}
        accessibilityState={{ selected: dashed }}
        bg={dashed ? 'a2' : 'surface2'}
        style={{
          height: 34,
          borderRadius: 999,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Svg width={20} height={8} viewBox="0 0 20 8">
          <Path
            d="M1 4h4M8 4h4M15 4h4"
            stroke={dashed ? colors['a2-ink'] : colors.text}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </Svg>
        <Txt size={12.5} weight={700} color={dashed ? 'a2-ink' : 'text'}>
          Kesikli
        </Txt>
      </Press>
      {round('Yönü çevir', 'flip', onFlip)}
      {round('Bağlantıyı sil', 'trash', onDelete)}
    </Animated.View>
  );
}
