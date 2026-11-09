import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { LOGO_D, LOGO_HOLES, LOGO_OUTER } from '@/components/Logo';
import { Button } from '@/components/ui/Controls';
import { Txt } from '@/components/ui/Txt';
import { bezier } from '@/lib/motion';
import { useTime } from '@/lib/ticker';
import { useTheme } from '@/theme/ThemeProvider';

// Boş ekran görseli (0.7.0): logo yuvaları boş, parçaları yerde. a1 parçası ara ara kendi
// yuvasına zıplayıp geri iner. Ölçüler viewBox="60 150 880 880" biriminde.

type Pose = { x: number; y: number; r: number };

function centroid(d: string) {
  const pts = [...d.matchAll(/(\d+) (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const x = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const y = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return { x, y };
}

/** Yerdeki parçalar: logonun kendi boşluk şekilleri, merkez (500,500) etrafına yerleşik. */
const PIECES = [
  { hole: 4, tint: 'a2', ground: { x: -210, y: 330, r: -24 }, sway: 0 },
  { hole: 1, tint: 'a3', ground: { x: 170, y: 250, r: 16 }, sway: 1200 },
  { hole: 2, tint: 'a1', ground: { x: -40, y: 420, r: -8 }, sway: 2400 },
] as const;
const CENTERS = LOGO_HOLES.map(centroid);
const OUTER_DASH = 68;
const jumpEase = bezier(0.5, 0, 0.3, 1);

/** a1 parçasının 4.8 sn'lik zıplama döngüsü (anahtar kareler yüzde olarak). */
const JUMP: [number, Pose][] = [
  [0, PIECES[2].ground],
  [0.3, PIECES[2].ground],
  [0.44, { x: -20, y: -40, r: 4 }],
  [0.5, { x: 0, y: 0, r: 0 }],
  [0.68, { x: 0, y: 0, r: 0 }],
  [0.74, { x: -10, y: -30, r: -4 }],
  [0.9, PIECES[2].ground],
  [1, PIECES[2].ground],
];

function jumpPose(p: number): Pose {
  for (let i = 0; i < JUMP.length - 1; i++) {
    const [a, pa] = JUMP[i];
    const [b, pb] = JUMP[i + 1];
    if (p >= a && p <= b) {
      const k = b === a ? 1 : jumpEase((p - a) / (b - a));
      return { x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k, r: pa.r + (pb.r - pa.r) * k };
    }
  }
  return PIECES[2].ground;
}

function transform(pose: Pose, c: { x: number; y: number }) {
  return `translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) rotate(${pose.r.toFixed(2)} ${c.x} ${c.y})`;
}

/** Boş liste görseli: 128×128 px. Hareketi azalt açıksa parçalar yerde durur. */
export function EmptyArt({ size = 128 }: { size?: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const t = useTime(!reduced);

  const flow = reduced ? 0 : -((t % 2200) / 2200) * OUTER_DASH;
  const jp = reduced ? 0 : (t % 4800) / 4800;
  const seated = jp >= 0.46 && jp <= 0.7;
  const ringP = jp >= 0.52 && jp <= 0.66 ? (jp - 0.52) / 0.14 : -1;

  const pose = (i: number): Pose => {
    const piece = PIECES[i];
    if (piece.tint === 'a1') return reduced ? piece.ground : jumpPose(jp);
    if (reduced) return piece.ground;
    // Salınım: 3.6 sn, 0 → 22 birim yukarı ve 6° → geri, yumuşak.
    const s = (1 - Math.cos((((t + piece.sway) % 3600) / 3600) * Math.PI * 2)) / 2;
    return { x: piece.ground.x, y: piece.ground.y - 22 * s, r: piece.ground.r + 6 * s };
  };

  const slot3 = CENTERS[2];
  return (
    <Svg width={size} height={size} viewBox="60 150 880 880" aria-hidden>
      <Ellipse cx={500} cy={985} rx={330} ry={26} fill={colors.text} opacity={0.08} />
      <Path d={LOGO_D} fill={colors.text} fillRule="evenodd" opacity={0.05} />
      <Path
        d={LOGO_OUTER}
        fill="none"
        stroke={colors['text-3']}
        opacity={0.45}
        strokeWidth={7}
        strokeDasharray={[18, 16]}
        strokeDashoffset={flow}
        strokeLinejoin="round"
      />
      {LOGO_HOLES.map((d, i) => {
        const lit = i === 2 && seated && !reduced;
        return (
          <Path
            key={i}
            d={d}
            fill="none"
            stroke={lit ? colors.a1 : colors['text-3']}
            opacity={lit ? 1 : 0.35}
            strokeWidth={6}
            strokeDasharray={[12, 12]}
            strokeLinejoin="round"
          />
        );
      })}
      {ringP >= 0 && (
        <Circle
          cx={slot3.x}
          cy={slot3.y}
          r={70 * (0.8 + 0.8 * ringP)}
          fill="none"
          stroke={colors.a1}
          strokeWidth={5}
          opacity={1 - ringP}
        />
      )}
      {PIECES.map((piece, i) => (
        <G key={piece.tint} transform={transform(pose(i), CENTERS[piece.hole])}>
          <Path
            d={LOGO_HOLES[piece.hole]}
            fill={colors[piece.tint]}
            stroke={colors.bg}
            strokeWidth={6}
            strokeLinejoin="round"
          />
        </G>
      ))}
    </Svg>
  );
}

/**
 * Boş liste ve filtre sonucu. Örn: "Havuz şimdilik boş" / "Yeni görev düşünce burada görünecek.
 * Acelesi yok." / "+ Görev öner".
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{ alignItems: 'center', gap: 6, paddingVertical: 18 }} accessibilityRole="summary">
      <EmptyArt />
      <Txt size={17} weight={800} style={{ textAlign: 'center', marginTop: 4 }}>
        {title}
      </Txt>
      {!!description && (
        <Txt size={13.5} color="muted" style={{ textAlign: 'center', maxWidth: 240 }}>
          {description}
        </Txt>
      )}
      {action && (
        <Button
          label={action.label}
          kind="soft"
          size="sm"
          onPress={action.onPress}
          style={{ marginTop: 6 }}
        />
      )}
    </View>
  );
}
