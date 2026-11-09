import { Image } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { ease, span } from '@/lib/motion';
import { useTime } from '@/lib/ticker';
import { cancelUpload, formatBytes, retryUpload, type UploadJob } from '@/lib/uploads';
import { css, EASE_OUT, EASE_SPRING, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

const PREVIEW = 62;

const cardIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: -18 }, { rotate: '-2deg' }, { scale: 0.94 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] },
});
const lift = css.keyframes({
  '0%': { transform: [{ translateY: 0 }, { scale: 1 }] },
  '45%': { transform: [{ translateY: -5 }, { scale: 1.02 }] },
  '100%': { transform: [{ translateY: 0 }, { scale: 1 }] },
});
const badgePop = css.keyframes({
  '0%': { transform: [{ scale: 0 }] },
  '60%': { transform: [{ scale: 1.2 }] },
  '100%': { transform: [{ scale: 1 }] },
});
const shimmer = css.keyframes({
  from: { transform: [{ translateX: '-100%' }] },
  to: { transform: [{ translateX: '250%' }] },
});
const waveFlow = css.keyframes({
  from: { transform: [{ translateX: 0 }] },
  to: { transform: [{ translateX: -24 }] },
});
const capsuleIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 16 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
});

/** Ses önizlemesindeki 12 dalga çubuğunun yükseklikleri. */
const BARS = [10, 18, 26, 14, 30, 22, 34, 16, 28, 12, 24, 18];

function Tick({ size, color }: { size: number; color: string }) {
  const motion = useMotion();
  const t = useTime(!motion.reduced);
  const p = motion.reduced ? 1 : ease.out(span(t, 150, 500));
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 12.5 10 17.5 19 7"
        fill="none"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={[21, 21]}
        strokeDashoffset={21 * (1 - p)}
      />
    </Svg>
  );
}

function Preview({ job, p }: { job: UploadJob; p: number }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const done = job.status === 'done';
  const cover = done ? 0 : 1 - p;

  if ((job.kind === 'image' || job.kind === 'video') && job.preview) {
    return (
      <View
        style={{
          width: PREVIEW,
          height: PREVIEW,
          borderRadius: 13,
          overflow: 'hidden',
          backgroundColor: colors.surface2,
        }}
      >
        <Image source={{ uri: job.preview }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {/* Kalan kısım bulanık ve gri: yükleme ilerledikçe örtü alttan yukarı çekilir. */}
        {cover > 0 && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: `${cover * 100}%`,
              overflow: 'hidden',
            }}
          >
            <Image
              source={{ uri: job.preview }}
              style={[
                { position: 'absolute', left: 0, top: 0, width: PREVIEW, height: PREVIEW },
                Platform.OS === 'web' ? ({ filter: 'blur(5px) grayscale(1)' } as object) : null,
              ]}
              blurRadius={Platform.OS === 'web' ? 0 : 5}
              contentFit="cover"
            />
            <View
              style={{ position: 'absolute', left: 0, right: 0, bottom: -4, height: 8, overflow: 'hidden' }}
            >
              <Animated.View
                style={[
                  { width: PREVIEW + 24, height: 8 },
                  motion.reduced
                    ? null
                    : {
                        animationName: waveFlow,
                        animationDuration: 1000,
                        animationIterationCount: 'infinite',
                        animationTimingFunction: 'linear',
                      },
                ]}
              >
                <Svg width={PREVIEW + 24} height={8} viewBox={`0 0 ${PREVIEW + 24} 8`}>
                  <Path
                    d={Array.from(
                      { length: Math.ceil((PREVIEW + 24) / 12) },
                      (_, i) => `${i ? '' : 'M0 4 '}q3 -3.5 6 0 t6 0`,
                    ).join(' ')}
                    fill="none"
                    stroke={colors.a1}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                  />
                </Svg>
              </Animated.View>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (job.kind === 'audio') {
    const lit = Math.floor((done ? 1 : p) * BARS.length);
    return (
      <View
        style={{
          width: PREVIEW,
          height: PREVIEW,
          borderRadius: 13,
          backgroundColor: colors.surface2,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        {BARS.map((h, i) => (
          <Animated.View
            key={i}
            style={[
              {
                width: 3,
                height: h,
                borderRadius: 2,
                backgroundColor: i < lit ? colors.a3 : colors['line-2'],
                transform: [{ scale: i < lit ? 1.12 : 1 }],
              },
              motion.transition(['transform', 'backgroundColor'], 400, EASE_SPRING),
            ]}
          />
        ))}
      </View>
    );
  }

  const dot = job.name.lastIndexOf('.');
  const ext = dot > 0 ? job.name.slice(dot + 1, dot + 5).toUpperCase() : 'DOSYA';
  return (
    <View
      style={{
        width: PREVIEW,
        height: PREVIEW,
        borderRadius: 13,
        backgroundColor: colors.surface2,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${(done ? 1 : p) * 100}%`,
            backgroundColor: colors.a1,
          },
          motion.transition('height', 300),
        ]}
      />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Txt size={13} weight={800} color={p > 0.55 || done ? 'a1-ink' : 'text-2'}>
          {ext}
        </Txt>
      </View>
    </View>
  );
}

/** Tek yükleme kartı. index: sıradaki kartlar 120 ms gecikmeyle girer. */
export function UploadCard({ job, index = 0 }: { job: UploadJob; index?: number }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const p = job.total ? job.loaded / job.total : 0;
  const pct = Math.round((job.status === 'done' ? 1 : p) * 100);
  const done = job.status === 'done';
  const failed = job.status === 'error';

  const sub =
    job.status === 'preparing'
      ? 'Hazırlanıyor…'
      : done
        ? `Yüklendi · ${formatBytes(job.total)}`
        : `${formatBytes(job.loaded)} / ${formatBytes(job.total)}${job.etaSec != null ? ` · ${job.etaSec} sn` : ''}`;

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.line,
          padding: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        motion.reduced
          ? null
          : done
            ? { animationName: lift, animationDuration: 600, animationTimingFunction: EASE_SPRING }
            : {
                animationName: cardIn,
                animationDuration: 550,
                animationDelay: index * 120,
                animationTimingFunction: EASE_SPRING,
                animationFillMode: 'both',
              },
      ]}
      accessibilityLabel={`${job.name}, ${done ? 'yüklendi' : failed ? 'yüklenemedi' : `yüzde ${pct}`}`}
    >
      <View>
        <Preview job={job} p={p} />
        {done && (
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: -6,
                right: -6,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.a3,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.surface,
              },
              motion.reduced
                ? null
                : { animationName: badgePop, animationDuration: 450, animationTimingFunction: EASE_SPRING },
            ]}
          >
            <Tick size={14} color={colors['a3-ink']} />
          </Animated.View>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Txt size={14} weight={800} numberOfLines={1}>
          {job.name}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {failed ? (
            <Txt size={12.5} color="muted" style={{ flex: 1 }}>
              Yüklenemedi ·{' '}
              <Txt
                size={12.5}
                weight={700}
                color="accent-text"
                onPress={() => retryUpload(job.id)}
                accessibilityRole="button"
              >
                Tekrar dene
              </Txt>
            </Txt>
          ) : (
            <Txt
              size={12.5}
              color="muted"
              numberOfLines={1}
              style={{ flex: 1, fontVariant: ['tabular-nums'] }}
            >
              {sub}
            </Txt>
          )}
          {!done && !failed && job.status !== 'preparing' && (
            <Txt size={12.5} weight={800} style={{ fontVariant: ['tabular-nums'] }}>
              %{pct}
            </Txt>
          )}
        </View>
        <Animated.View
          style={[
            {
              height: done ? 0 : 5,
              borderRadius: 3,
              backgroundColor: colors.surface2,
              overflow: 'hidden',
              opacity: failed ? 0.4 : 1,
            },
            motion.transition(['height', 'opacity'], 400),
          ]}
        >
          <View style={{ width: `${pct}%`, height: '100%' }}>
            <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 5">
              <Defs>
                <LinearGradient id={`up-${job.id}`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={colors.a2} />
                  <Stop offset="0.5" stopColor={colors.a1} />
                  <Stop offset="1" stopColor={colors.a3} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={100} height={5} fill={`url(#up-${job.id})`} />
            </Svg>
            {!failed && !motion.reduced && (
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: '30%',
                  backgroundColor: 'rgba(255,255,255,0.55)',
                  animationName: shimmer,
                  animationDuration: 1100,
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                }}
              />
            )}
          </View>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          {
            transform: [{ rotate: done ? '90deg' : '0deg' }, { scale: done ? 0 : 1 }],
            opacity: done ? 0 : 1,
          },
          motion.transition(['transform', 'opacity'], 400, EASE_OUT),
        ]}
      >
        <Press
          onPress={() => cancelUpload(job.id)}
          disabled={done}
          accessibilityLabel={`${job.name} yüklemesini iptal et`}
          bg="surface2"
          style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
          hitSlop={8}
        >
          <Icon name="close" size={13} color={colors.text} strokeWidth={2.4} />
        </Press>
      </Animated.View>
    </Animated.View>
  );
}

/** Yükleme kartları alt alta; hepsi bitince altta özet kapsülü belirir. */
export function UploadList({ jobs, target }: { jobs: UploadJob[]; target: string }) {
  const { colors } = useTheme();
  const motion = useMotion();
  if (!jobs.length) return null;
  const allDone = jobs.every((j) => j.status === 'done');
  return (
    <View style={{ gap: 10 }}>
      {jobs.map((j, i) => (
        <UploadCard key={j.id} job={j} index={i} />
      ))}
      {allDone && (
        <Animated.View
          style={[
            {
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 999,
              paddingVertical: 8,
              paddingHorizontal: 14,
            },
            motion.reduced
              ? null
              : {
                  animationName: capsuleIn,
                  animationDuration: 450,
                  animationDelay: 300,
                  animationTimingFunction: EASE_SPRING,
                  animationFillMode: 'both',
                },
          ]}
          accessibilityLiveRegion="polite"
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.a3 }} />
          <Txt size={13} weight={600}>
            {jobs.length} dosya {target} eklendi
          </Txt>
        </Animated.View>
      )}
    </View>
  );
}
