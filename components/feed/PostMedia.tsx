import { Image } from 'expo-image';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { useIsWide } from '@/components/layout/useIsWide';
import { Txt } from '@/components/ui/Txt';
import type { PostMedia as Media } from '@/lib/types';
import { css, EASE_OUT, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

const grow = css.keyframes({ from: { transform: [{ scaleX: 0 }] }, to: { transform: [{ scaleX: 1 }] } });

/** Paylaşımdaki görsel. "ornek" olanlar prototipteki çizim yer tutucuları (seed verisi). */
export function PostMedia({ media }: { media: Media }) {
  const wide = useIsWide();
  if (media.type === 'image') {
    return (
      <Image
        source={{ uri: media.url }}
        style={{ height: wide ? 260 : 190, borderRadius: 20 }}
        contentFit="cover"
        accessibilityLabel="Paylaşılan görsel"
      />
    );
  }
  if (media.art === 'face') return <FaceArt tall={wide} />;
  if (media.art === 'video') return <VideoArt tall={wide} />;
  return <MoodArt tall={wide} />;
}

function FaceArt({ tall }: { tall: boolean }) {
  const motion = useMotion();
  return (
    <View
      style={{
        height: tall ? 260 : 190,
        borderRadius: 20,
        backgroundColor: '#C5B5FA',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tall ? 30 : 18,
        overflow: 'hidden',
      }}
      accessibilityLabel="Yüz ifadesi taslakları"
    >
      <Svg width={92} height={112} viewBox="0 0 92 112" fill="none" stroke="#0E0E10" strokeWidth={2.5} strokeLinecap="round">
        <Ellipse cx={46} cy={58} rx={34} ry={44} />
        <Circle cx={33} cy={52} r={4} />
        <Circle cx={59} cy={52} r={4} />
        <Path d="M34 80q12 8 24 0" />
      </Svg>
      <Svg width={92} height={112} viewBox="0 0 92 112" fill="none" stroke="#0E0E10" strokeWidth={2.5} strokeLinecap="round">
        <Ellipse cx={46} cy={58} rx={34} ry={44} />
        <Circle cx={33} cy={50} r={8} />
        <Circle cx={59} cy={50} r={8} />
        <Ellipse cx={46} cy={84} rx={7} ry={10} />
      </Svg>
      <View style={{ position: 'absolute', left: tall ? '55%' : '57%', top: tall ? '30%' : '27%' }}>
        <Animated.View
          style={[
            { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#0E0E10' },
            motion.ring(),
          ]}
        />
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#0E0E10',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt size={12} weight={800} leading={1} style={{ color: '#E4F68F' }}>
            1
          </Txt>
        </View>
      </View>
    </View>
  );
}

function VideoArt({ tall }: { tall: boolean }) {
  const { colors } = useTheme();
  const motion = useMotion();
  return (
    <View
      style={{
        height: tall ? 230 : 170,
        borderRadius: 20,
        backgroundColor: colors.a3,
        alignItems: 'center',
        justifyContent: 'center',
        gap: tall ? 18 : 16,
      }}
      accessibilityLabel="Video taslağı"
    >
      <View
        style={{
          width: tall ? 60 : 54,
          height: tall ? 60 : 54,
          borderRadius: 30,
          backgroundColor: '#0E0E10',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path d="M8 5v14l11-7z" fill="#8EE8F5" />
        </Svg>
      </View>
      <View style={{ width: tall ? '70%' : '78%', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt size={12} weight={700} color="a3-ink">
          0:00
        </Txt>
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(14,14,16,.25)' }}>
          <Animated.View
            style={[
              { width: '34%', height: 4, borderRadius: 2, backgroundColor: '#0E0E10', transformOrigin: 'left' },
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
        </View>
        <Txt size={12} weight={700} color="a3-ink">
          0:20
        </Txt>
      </View>
    </View>
  );
}

const MOOD = ['#6B4E3D', '#C9A66B', '#2F3B3A', '#8C3B2E', '#E8D9B5', '#4A5A6A'];

function MoodArt({ tall }: { tall: boolean }) {
  return (
    <View
      style={{ height: tall ? 230 : 170, borderRadius: 20, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}
      accessibilityLabel="Moodboard"
    >
      {MOOD.map((c) => (
        <View key={c} style={{ width: '32.2%', flexGrow: 1, height: '49%', backgroundColor: c }} />
      ))}
    </View>
  );
}
