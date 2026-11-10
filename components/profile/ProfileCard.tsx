// Profil kartı (mini kart ve düzenleme önizlemesi aynı bileşen) ve durum noktalı avatar.
// Ölçüler ABN Profil Prototipi'ndeki .pcard / .av / .dot ile aynı.

import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Txt } from '@/components/ui/Txt';
import { BANNER } from '@/lib/labels';
import { customStatus, shade, STATUS, statusOf } from '@/lib/presence';
import type { BannerColor, Profile } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';

export type CardPerson = Pick<
  Profile,
  | 'id'
  | 'full_name'
  | 'username'
  | 'avatar_url'
  | 'avatar_color'
  | 'banner_url'
  | 'banner_color'
  | 'bio'
  | 'role_title'
  | 'skills'
  | 'status'
  | 'custom_status'
  | 'custom_status_emoji'
  | 'custom_status_expires_at'
  | 'pronouns'
  | 'accent_color'
>;

/** Avatar + sağ altta durum noktası. ring: noktanın çevresindeki halkanın rengi (zeminle aynı). */
export function PresenceAvatar({
  person,
  size,
  isMe,
  ring,
  dot = true,
}: {
  person: Pick<CardPerson, 'full_name' | 'avatar_url' | 'avatar_color' | 'status'>;
  size: number;
  isMe: boolean;
  ring: string;
  dot?: boolean;
}) {
  const s = statusOf(person, isMe);
  const d = Math.max(10, size * 0.32);
  const r = Math.max(2.5, size * 0.06);
  return (
    <View style={{ width: size, height: size }}>
      <Avatar person={person} size={size} />
      {dot && (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: d,
            height: d,
            borderRadius: d / 2,
            backgroundColor: s === 'invisible' ? ring : STATUS[s].color,
            boxShadow:
              s === 'invisible'
                ? `0 0 0 ${r}px ${ring}, inset 0 0 0 ${Math.max(2.5, size * 0.07)}px ${STATUS.invisible.color}`
                : `0 0 0 ${r}px ${ring}`,
          }}
        />
      )}
    </View>
  );
}

/** Banner zemini: görsel, serbest renk (gradyan) ya da eski hazır renk. */
export function useBannerStyle(p: Pick<CardPerson, 'banner_url' | 'banner_color'>) {
  const { colors } = useTheme();
  if (p.banner_url)
    return { backgroundImage: `url(${p.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } as object;
  const c = p.banner_color.startsWith('#')
    ? p.banner_color
    : (() => {
        const bg = BANNER[p.banner_color as BannerColor]?.bg ?? 'a2';
        return (colors as Record<string, string>)[bg] ?? bg;
      })();
  const hex = /^#[0-9a-f]{6}$/i.test(c) ? c : null;
  return hex
    ? ({ backgroundImage: `linear-gradient(160deg, ${hex}, ${shade(hex, -28)})` } as object)
    : { backgroundColor: c };
}

export function RoleChips({ person }: { person: Pick<CardPerson, 'role_title' | 'skills'> }) {
  const { colors } = useTheme();
  const roles = [person.role_title, ...(person.skills ?? [])].filter(Boolean);
  const dots = [colors.a1, colors.a2, colors.a3];
  if (!roles.length)
    return (
      <Txt size={12.5} color="muted">
        Rol yok
      </Txt>
    );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {[...new Set(roles)].map((r, i) => (
        <View
          key={r}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 3,
            paddingHorizontal: 9,
            borderRadius: 999,
            backgroundColor: colors.chip,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dots[i % 3] }} />
          <Txt size={12} weight={700}>
            {r}
          </Txt>
        </View>
      ))}
    </View>
  );
}

export function Label({ children }: { children: string }) {
  return (
    <Txt size={11} weight={800} color="muted" style={{ letterSpacing: 0.88, textTransform: 'uppercase' }}>
      {children}
    </Txt>
  );
}

/** 300 px profil kartı. children: kartın altına eklenen bölüm (mini karttaki işlemler). */
export function ProfileCard({
  person,
  isMe,
  children,
  shadow,
}: {
  person: CardPerson;
  isMe: boolean;
  children?: ReactNode;
  shadow?: string;
}) {
  const { colors } = useTheme();
  const banner = useBannerStyle(person);
  const cs = customStatus(person);
  return (
    <View
      style={{
        width: 300,
        borderRadius: 18,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        boxShadow: shadow ?? `0 0 0 1px ${colors.line}`,
      }}
    >
      <View style={[{ height: 80 }, banner]} />
      <View
        style={{
          position: 'absolute',
          left: 16,
          top: 38,
          borderRadius: 999,
          padding: 5,
          backgroundColor: colors.surface,
        }}
      >
        <PresenceAvatar person={person} size={72} isMe={isMe} ring={colors.surface} />
      </View>
      <View style={{ paddingTop: 44, paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
        <View>
          <Txt size={19} weight={800} leading={1.15}>
            {person.full_name || 'Adsız'}
          </Txt>
          <Txt size={13} weight={600} color="muted">
            @{person.username}
            {person.pronouns ? ' · ' + person.pronouns : ''}
          </Txt>
        </View>
        {cs && (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 12,
              backgroundColor: colors.surface2,
            }}
          >
            <Txt size={13}>{cs.emoji}</Txt>
            <Txt size={13} weight={600} style={{ flex: 1 }}>
              {cs.text}
            </Txt>
          </View>
        )}
        <View style={{ borderRadius: 14, backgroundColor: colors.surface2, padding: 12, gap: 10 }}>
          {person.bio ? (
            <View style={{ gap: 2 }}>
              <Label>Hakkında</Label>
              <Txt size={13.5} color="text-2">
                {person.bio}
              </Txt>
            </View>
          ) : null}
          <View style={{ gap: 6 }}>
            <Label>Roller</Label>
            <RoleChips person={person} />
          </View>
        </View>
        {children}
      </View>
    </View>
  );
}
