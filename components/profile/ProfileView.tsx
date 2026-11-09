import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { useIsWide } from '@/components/layout/useIsWide';
import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Button, Card, SectionTitle } from '@/components/ui/Controls';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { openDirectRoom } from '@/lib/chat';
import { friendlyError } from '@/lib/errors';
import { AVAILABILITY } from '@/lib/labels';
import { useFeed, useTasks } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import { useLauncherVersion } from '@/lib/desktop';
import { APP_VERSION } from '@/lib/version';
import { timeAgo } from '@/lib/time';
import type { Profile } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { availabilityLabel } from './availability';
import { Banner } from './Banner';
import { PasswordForm } from './PasswordForm';
import { ProfileEditForm } from './ProfileEditForm';

/** Profil sayfası (Main.dc.html ve Desktop.dc.html "PROFİL"). Kişinin kendisiyse düzenlenebilir. */
export function ProfileView({ id }: { id: string | undefined }) {
  const team = useTeam();
  const person = id ? team.person(id) : undefined;

  if (team.loading || !id) {
    return (
      <Screen title="Profil" crumb="Ekip" back>
        <SkeletonCards count={2} />
      </Screen>
    );
  }
  if (!person) {
    return (
      <Screen title="Profil" crumb="Ekip" back>
        <ErrorState
          message={team.error ?? 'Bu kişi bulunamadı. Ekipten ayrılmış olabilir.'}
          onRetry={team.error ? team.refetch : undefined}
        />
      </Screen>
    );
  }
  return <Content person={person} />;
}

function Content({ person }: { person: Profile }) {
  const { colors } = useTheme();
  const wide = useIsWide();
  const team = useTeam();
  const { signOut, profile: me } = useAuth();
  const say = useToast();
  const tasks = useTasks();
  const feed = useFeed();
  const [editing, setEditing] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const launcherVersion = useLauncherVersion();

  const isMe = person.id === team.meId;
  const avail = AVAILABILITY[person.availability];
  const mineTasks = (tasks.data ?? []).filter((t) => t.assignee_id === person.id);
  const done = mineTasks.filter((t) => t.status === 'bitti').length;
  const open = mineTasks.length - done;
  const projects = team.projects.filter((p) => p.members.includes(person.id));
  const posts = (feed.data ?? []).filter((p) => p.author_id === person.id);

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/ekip'));

  async function message() {
    try {
      const roomId = await openDirectRoom(person.id);
      router.navigate({ pathname: '/sohbet/[id]', params: { id: roomId } });
    } catch (e) {
      say(friendlyError(e));
    }
  }

  const header = (
    <View>
      <Banner
        color={person.banner_color}
        url={person.banner_url}
        height={wide ? 220 : 170}
        radius={wide ? 28 : 0}
      >
        <Press
          onPress={back}
          accessibilityLabel="Geri"
          style={{
            position: 'absolute',
            top: wide ? 18 : 16,
            left: wide ? 18 : 16,
            height: 40,
            minWidth: 40,
            borderRadius: 20,
            paddingHorizontal: wide ? 14 : 0,
            paddingLeft: wide ? 10 : 0,
            backgroundColor: 'rgba(14,14,16,0.55)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Icon name="back" size={20} color="#FFFFFF" strokeWidth={2} />
          {wide && (
            <Txt size={14} weight={600} style={{ color: '#FFFFFF' }}>
              Geri
            </Txt>
          )}
        </Press>
      </Banner>
      <View
        style={{
          paddingHorizontal: wide ? 28 : 20,
          marginTop: wide ? -60 : -52,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: wide ? 18 : 12,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ borderRadius: 999, borderWidth: wide ? 6 : 5, borderColor: colors.bg }}>
          <Avatar person={person} size={wide ? 116 : 90} />
        </View>
        {wide && (
          <View style={{ flex: 1, paddingBottom: 8, minWidth: 200 }}>
            <Txt size={30} weight={700} leading={1.1}>
              {person.full_name}
            </Txt>
            <RoleLine person={person} isMe={isMe} dot={avail.color} />
          </View>
        )}
        {isMe ? (
          <Button
            label="Profili düzenle"
            kind="sel"
            icon="edit"
            onPress={() => setEditing(true)}
            style={{ marginBottom: wide ? 8 : 0 }}
          />
        ) : (
          <Button
            label="Mesaj gönder"
            kind="sel"
            icon="sohbet"
            onPress={message}
            style={{ marginBottom: wide ? 8 : 0 }}
          />
        )}
      </View>
    </View>
  );

  const details = (
    <View style={{ paddingHorizontal: wide ? 28 : 20, gap: 16 }}>
      {!wide && (
        <View style={{ gap: 4 }}>
          <Txt size={28} weight={700} leading={1.1} role="heading">
            {person.full_name}
          </Txt>
          <RoleLine person={person} isMe={isMe} dot={avail.color} />
        </View>
      )}
      {person.bio ? (
        <Txt size={15.5} style={{ maxWidth: 520 }}>
          {person.bio}
        </Txt>
      ) : (
        <Txt size={14.5} color="muted">
          Henüz bir şey yazılmamış.
        </Txt>
      )}

      {(person.skills ?? []).length > 0 && (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
          accessibilityLabel={`Yaptıkları: ${person.skills.join(', ')}`}
        >
          {person.skills.map((sk) => (
            <Box
              key={sk}
              bg="surface2"
              style={{ borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 }}
            >
              <Txt size={13} weight={600} color="text-3">
                {sk}
              </Txt>
            </Box>
          ))}
        </View>
      )}

      <View style={{ gap: 8, maxWidth: 560 }}>
        {person.links.map((l, i) => (
          <Press
            key={`${l.url}-${i}`}
            onPress={() => Linking.openURL(/^https?:\/\//.test(l.url) ? l.url : `https://${l.url}`)}
            bg="surface"
            shadow
            accessibilityRole="link"
            style={{
              borderRadius: 18,
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Box
              bg="a2"
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="link" size={16} color={colors['a2-ink']} strokeWidth={2.2} />
            </Box>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt size={14.5} weight={700}>
                {l.label}
              </Txt>
              <Txt size={13} color="muted" numberOfLines={1}>
                {l.url}
              </Txt>
            </View>
            <Icon name="external" size={16} color={colors.muted} strokeWidth={2} />
          </Press>
        ))}
        {isMe && person.links.length === 0 && (
          <Press
            onPress={() => setEditing(true)}
            style={{
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors['line-2'],
              borderRadius: 18,
              padding: 14,
              alignItems: 'center',
            }}
          >
            <Txt size={14} weight={600} color="muted">
              + Link ekle (portfolyo, Instagram, YouTube…)
            </Txt>
          </Press>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, maxWidth: 560 }}>
        <Box bg="a1" style={{ flex: 1, borderRadius: 20, padding: 14 }}>
          <Txt size={24} weight={700} color="a1-ink" leading={1.2} style={{ fontVariant: ['tabular-nums'] }}>
            {done}
          </Txt>
          <Txt size={13} weight={600} color="a1-ink">
            Bitirdiği görev
          </Txt>
        </Box>
        <Box bg="a3" style={{ flex: 1, borderRadius: 20, padding: 14 }}>
          <Txt size={24} weight={700} color="a3-ink" leading={1.2} style={{ fontVariant: ['tabular-nums'] }}>
            {open}
          </Txt>
          <Txt size={13} weight={600} color="a3-ink">
            Üzerindeki görev
          </Txt>
        </Box>
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle>Projeleri</SectionTitle>
        {projects.length === 0 && (
          <Txt size={14} color="muted">
            Henüz bir projede değil.
          </Txt>
        )}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {projects.map((p) => (
            <Press
              key={p.id}
              onPress={() => router.navigate({ pathname: '/projeler/[id]', params: { id: p.id } })}
              bg="surface"
              shadow
              style={{ borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}
            >
              <Txt size={13} weight={600} color="text-2">
                {p.name}
              </Txt>
            </Press>
          ))}
        </View>
      </View>

      <View style={{ gap: 10, paddingBottom: 8, maxWidth: 720 }}>
        <SectionTitle>Paylaşımları</SectionTitle>
        {posts.length === 0 && (
          <Txt size={14} color="muted">
            Henüz paylaşım yok.
          </Txt>
        )}
        {posts.map((p) => (
          <Card key={p.id} radius={18} padding={14} gap={4}>
            <Txt size={12.5} weight={600} color="accent-text">
              {(p.project_id && team.projectMap.get(p.project_id)?.name) || 'Genel'} ·{' '}
              <Txt size={12.5} weight={500} color="muted">
                {timeAgo(p.created_at)}
              </Txt>
            </Txt>
            <Txt size={14.5}>{p.body}</Txt>
          </Card>
        ))}
      </View>

      {isMe && (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {/* Telefonda sol menü yok; yöneticiler panele buradan ulaşır. */}
          {!wide && person.is_admin && (
            <Button
              label="Yönetim paneli"
              kind="accent"
              icon="shield"
              onPress={() => router.navigate('/yonetim')}
            />
          )}
          <Button label="Şifremi değiştir" kind="soft" icon="lock" onPress={() => setChangingPw(true)} />
          <Button label="Çıkış yap" kind="soft" icon="logout" onPress={signOut} />
        </View>
      )}
      {isMe && (
        <View style={{ alignItems: 'center', gap: 4, marginTop: 8 }}>
          <Press
            onPress={() => router.navigate('/hosgeldin')}
            accessibilityRole="link"
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Txt size={14} weight={600} color="accent-text">
              Hoş geldin turunu tekrar aç
            </Txt>
          </Press>
          <Txt size={12.5} color="faint">
            Sürüm {APP_VERSION}
            {launcherVersion ? ` · Launcher ${launcherVersion}` : ''}
          </Txt>
        </View>
      )}
    </View>
  );

  return (
    <Screen title={person.full_name} crumb="Ekip" bare>
      {header}
      {details}
      {isMe && me && (
        <Sheet open={editing} onClose={() => setEditing(false)} label="Profili düzenle">
          <ProfileEditForm profile={me} onClose={() => setEditing(false)} />
        </Sheet>
      )}
      {isMe && (
        <Sheet open={changingPw} onClose={() => setChangingPw(false)} label="Şifremi değiştir">
          <PasswordForm onClose={() => setChangingPw(false)} />
        </Sheet>
      )}
    </Screen>
  );
}

function RoleLine({ person, isMe, dot }: { person: Profile; isMe: boolean; dot: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {!!person.role_title && (
        <>
          <Txt size={14} color="muted">
            {person.role_title}
          </Txt>
          <Txt size={14} color="muted">
            ·
          </Txt>
        </>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
        <Txt size={14} weight={600} color="text-2">
          {availabilityLabel(person, isMe, true)}
        </Txt>
      </View>
    </View>
  );
}
