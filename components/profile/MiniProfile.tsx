// Sol alttaki kullanıcı kartına tıklayınca kartın üstünde açılan mini profil (ABN Profil Prototipi: .mini).
// Arka plan kararmaz. Açılış sol alt köşeden yay eğrisiyle 0.24 sn, kapanış 0.15 sn. Durum ve özel durum
// yan menüleri (.flyout) kartın sağında açılır.

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { CS_EMOJIS, CS_EXPIRY, customStatus, expiryDate, STATUS, STATUS_ORDER } from '@/lib/presence';
import { openProfile } from '@/lib/profileModal';
import type { PresenceStatus, Profile } from '@/lib/types';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { ProfileCard } from './ProfileCard';

const SPRING = 'cubic-bezier(0.2, 1.25, 0.35, 1)';
const miniIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 8 }, { scale: 0.96 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const miniOut = css.keyframes({
  from: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  to: { opacity: 0, transform: [{ translateY: 4 }, { scale: 0.98 }] },
});
const flyIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateX: -6 }] },
  to: { opacity: 1, transform: [{ translateX: 0 }] },
});
const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const fadeOut = css.keyframes({ from: { opacity: 1 }, to: { opacity: 0 } });

export function useShadow() {
  const { theme } = useTheme();
  return theme.scheme === 'dark' ? '0 24px 60px rgba(0,0,0,.55)' : '0 20px 50px rgba(20,50,35,.16)';
}

type Fly = 'status' | 'cs' | null;

/** closing: kapanış animasyonu oynuyor. anchor: kartın altındaki boşluk (px). */
export function MiniProfile({
  closing,
  bottom,
  onClose,
  ignore,
}: {
  closing: boolean;
  bottom: number;
  onClose: () => void;
  /** Bu öğeye tıklama "dışarı tıklama" sayılmaz (sol alttaki kart; tekrar tıklayınca kendisi kapatır). */
  ignore: React.RefObject<unknown>;
}) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const motion = useMotion();
  const shadow = useShadow();
  const [fly, setFly] = useState<Fly>(null);
  const box = useRef<unknown>(null);
  const flyRef = useRef(fly);
  useEffect(() => {
    flyRef.current = fly;
  }, [fly]);

  // Dışarı tıklama ve Esc (yan menü açıksa önce o kapanır).
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      const el = box.current as unknown as HTMLElement | null;
      const ig = ignore.current as unknown as HTMLElement | null;
      if (el?.contains(t) || ig?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (flyRef.current) setFly(null);
      else onClose();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
    };
  }, [onClose, ignore]);

  if (!profile) return null;
  const s = STATUS[profile.status ?? 'online'];
  const cs = customStatus(profile);
  const anim = motion.reduced
    ? { animationName: closing ? fadeOut : fadeIn, animationDuration: closing ? 120 : 150 }
    : {
        animationName: closing ? miniOut : miniIn,
        animationDuration: closing ? 150 : 240,
        animationTimingFunction: closing ? 'ease' : SPRING,
      };

  return (
    <Animated.View
      ref={box as never}
      role="dialog"
      aria-label="Profilin"
      style={[
        { position: 'absolute', left: 14, bottom, zIndex: 30, transformOrigin: 'left bottom' },
        { ...anim, animationFillMode: 'both' },
      ]}
    >
      <ProfileCard person={profile} isMe shadow={`0 0 0 1px ${colors.line}, ${shadow}`}>
        <View style={{ borderRadius: 14, backgroundColor: colors.surface2, padding: 6, gap: 2 }}>
          <Act
            icon={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />}
            label={s.label}
            chev
            open={fly === 'status'}
            onPress={() => setFly(fly === 'status' ? null : 'status')}
          />
          <Act
            icon={<Txt>😀</Txt>}
            label={cs ? 'Özel durumu değiştir' : 'Özel durum ayarla'}
            open={fly === 'cs'}
            onPress={() => setFly(fly === 'cs' ? null : 'cs')}
          />
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 2 }} />
          <Act
            icon={<Txt>✏️</Txt>}
            label="Profili düzenle"
            onPress={() => {
              onClose();
              router.navigate('/profil?duzenle=1');
            }}
          />
          <Act
            icon={<Txt>⤢</Txt>}
            label="Tam profili aç"
            onPress={() => {
              onClose();
              openProfile(profile.id);
            }}
          />
        </View>
      </ProfileCard>
      {fly && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 308,
            bottom: 0,
            width: fly === 'cs' ? 260 : 220,
            padding: 6,
            borderRadius: 14,
            backgroundColor: colors.surface,
            boxShadow: `0 0 0 1px ${colors.line}, ${shadow}`,
            zIndex: 31,
            animationName: motion.reduced ? fadeIn : flyIn,
            animationDuration: motion.reduced ? 150 : 180,
            animationTimingFunction: SPRING,
            animationFillMode: 'both',
          }}
        >
          {fly === 'status' ? (
            <StatusMenu me={profile} onDone={() => setFly(null)} />
          ) : (
            <CustomStatusForm me={profile} onDone={() => setFly(null)} />
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function Act({
  icon,
  label,
  sub,
  chev,
  check,
  open,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  chev?: boolean;
  check?: boolean;
  open?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const [hover, setHover] = useState(false);
  const acc = colors.a1;
  return (
    <Press
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityRole="menuitem"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: hover || open ? `color-mix(in srgb, ${acc} 22%, transparent)` : undefined,
      }}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={13.5} weight={700}>
          {label}
        </Txt>
        {sub ? (
          <Txt size={11.5} weight={600} color="muted">
            {sub}
          </Txt>
        ) : null}
      </View>
      {chev && <Txt color="muted">›</Txt>}
      {check && <Txt color="muted">✓</Txt>}
    </Press>
  );
}

function StatusMenu({ me, onDone }: { me: Profile; onDone: () => void }) {
  const { updateProfile } = useAuth();
  const say = useToast();
  const set = async (st: PresenceStatus) => {
    onDone();
    const err = await updateProfile({ status: st });
    if (err) say(err);
  };
  return (
    <View role="menu">
      {STATUS_ORDER.map((k) => (
        <Act
          key={k}
          icon={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS[k].color }} />}
          label={STATUS[k].label}
          sub={STATUS[k].desc}
          check={(me.status ?? 'online') === k}
          onPress={() => set(k)}
        />
      ))}
    </View>
  );
}

function CustomStatusForm({ me, onDone }: { me: Profile; onDone: () => void }) {
  const { colors } = useTheme();
  const { updateProfile } = useAuth();
  const say = useToast();
  const cur = customStatus(me);
  const [emoji, setEmoji] = useState(cur?.emoji ?? '🎨');
  const [text, setText] = useState(cur?.text ?? '');
  const [exp, setExp] = useState<(typeof CS_EXPIRY)[number]['value']>('today');

  const save = async (clear = false) => {
    onDone();
    const t = clear ? '' : text.trim();
    const err = await updateProfile({
      custom_status: t,
      custom_status_emoji: t ? emoji : '',
      custom_status_expires_at: t ? expiryDate(exp) : null,
    });
    say(err ?? (t ? 'Özel durum güncellendi' : 'Özel durum temizlendi'));
  };

  const field = {
    width: '100%',
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: 14,
    fontFamily: 'Urbanist',
  } as const;

  return (
    <View style={{ gap: 10, paddingVertical: 4, paddingHorizontal: 2 }}>
      <Txt size={11} weight={800} color="muted" style={{ letterSpacing: 0.88, textTransform: 'uppercase' }}>
        Özel durum
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {CS_EMOJIS.map((e) => (
          <Press
            key={e}
            onPress={() => setEmoji(e)}
            accessibilityState={{ selected: e === emoji }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface2,
              boxShadow: e === emoji ? `inset 0 0 0 2px ${colors.a1}` : undefined,
            }}
          >
            <Txt size={17}>{e}</Txt>
          </Press>
        ))}
      </View>
      <TextInput
        autoFocus
        value={text}
        onChangeText={setText}
        maxLength={60}
        placeholder="Ne yapıyorsun?"
        placeholderTextColor={colors.muted}
        onSubmitEditing={() => save()}
        style={[field, { outlineStyle: 'none' } as object]}
      />
      <select
        value={exp}
        onChange={(e) => setExp(e.target.value as typeof exp)}
        style={{ ...field, appearance: 'auto' }}
        aria-label="Bitiş süresi"
      >
        {CS_EXPIRY.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Press
          onPress={() => save(true)}
          style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.chip }}
        >
          <Txt size={13} weight={800}>
            Temizle
          </Txt>
        </Press>
        <Press
          onPress={() => save()}
          bg="a2"
          gradient="btn"
          style={{ marginLeft: 'auto', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999 }}
        >
          <Txt size={13} weight={800} color="a2-ink">
            Kaydet
          </Txt>
        </Press>
      </View>
    </View>
  );
}
