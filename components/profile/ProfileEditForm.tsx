import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button, Field, IconButton, paint } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Txt } from '@/components/ui/Txt';
import { Box } from '@/components/ui/Box';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { BANNER } from '@/lib/labels';
import { uploadProfileImage, type PickedImage } from '@/lib/queries';
import type { BannerColor, Profile, ProfileLink } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Select, Switch } from '@/components/ui/Select';
import { Banner } from './Banner';

const BIO_MAX = 160;
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }));

async function pickImage(aspect: [number, number]): Promise<PickedImage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.8,
    base64: true,
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, base64: a.base64, mimeType: a.mimeType, file: a.file };
}

/** "Profili düzenle" paneli (Main.dc.html sheetProfile). Görseller Kaydet'e basınca yüklenir. */
export function ProfileEditForm({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { colors } = useTheme();
  const say = useToast();
  const { updateProfile } = useAuth();

  const [bannerColor, setBannerColor] = useState<BannerColor>(profile.banner_color);
  const [bannerUrl, setBannerUrl] = useState(profile.banner_url);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [newBanner, setNewBanner] = useState<PickedImage | null>(null);
  const [newAvatar, setNewAvatar] = useState<PickedImage | null>(null);
  const [bio, setBio] = useState(profile.bio);
  const [links, setLinks] = useState<ProfileLink[]>(profile.links);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [quiet, setQuiet] = useState(profile.quiet_start !== null && profile.quiet_end !== null);
  const [quietStart, setQuietStart] = useState(String(profile.quiet_start ?? 23));
  const [quietEnd, setQuietEnd] = useState(String(profile.quiet_end ?? 8));

  const bannerPreview = newBanner?.uri ?? bannerUrl;
  const avatarPreview = newAvatar?.uri ?? avatarUrl;

  function addLink() {
    const url = linkUrl.trim().replace(/^https?:\/\//, '');
    if (!url) {
      say('Önce link adresini yaz');
      return;
    }
    setLinks([...links, { label: linkLabel.trim() || url.split('/')[0], url }]);
    setLinkLabel('');
    setLinkUrl('');
  }

  /** SubmitButton için: hata metni ya da null. Başarıda "Kaydedildi" görünür, panel sonra kapanır. */
  async function save() {
    try {
      const patch: Partial<Profile> = {
        banner_color: bannerColor,
        bio: bio.trim(),
        links,
        quiet_start: quiet ? Number(quietStart) : null,
        quiet_end: quiet ? Number(quietEnd) : null,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
      };
      patch.banner_url = newBanner ? await uploadProfileImage('banners', profile.id, newBanner) : bannerUrl;
      patch.avatar_url = newAvatar ? await uploadProfileImage('avatars', profile.id, newAvatar) : avatarUrl;
      const error = await updateProfile(patch);
      if (error) return error;
      setTimeout(onClose, 900);
      return null;
    } catch (e) {
      return friendlyError(e, 'Görsel yüklenemedi. Daha küçük bir görselle tekrar dene.');
    }
  }

  const softButton = (label: string, onPress: () => void) => (
    <Press onPress={onPress} bg="surface2" style={{ borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 }}>
      <Txt size={14} weight={600}>
        {label}
      </Txt>
    </Press>
  );

  return (
    <View style={{ gap: 14 }}>
      <Txt size={22} weight={700} leading={1.2}>
        Profili düzenle
      </Txt>

      <View style={{ paddingBottom: 36 }}>
        <Banner color={bannerColor} url={bannerPreview} height={112} radius={20} />
        <View
          style={{
            position: 'absolute',
            left: 16,
            bottom: 0,
            borderRadius: 42,
            borderWidth: 4,
            borderColor: colors.surface,
          }}
        >
          <Avatar person={{ full_name: profile.full_name, avatar_color: profile.avatar_color, avatar_url: avatarPreview }} size={68} />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Txt size={13} color="muted">
          Afiş
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {softButton('Görsel yükle', async () => {
            const img = await pickImage([3, 1]);
            if (img) setNewBanner(img);
          })}
          {(Object.keys(BANNER) as BannerColor[]).map((k) => {
            const active = bannerColor === k && !bannerPreview;
            return (
              <Press
                key={k}
                onPress={() => {
                  setBannerColor(k);
                  setBannerUrl(null);
                  setNewBanner(null);
                }}
                accessibilityLabel={`${BANNER[k].label} afiş`}
                accessibilityState={{ selected: active }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: paint(colors, BANNER[k].bg),
                  boxShadow: `0 0 0 2px ${colors.surface}, 0 0 0 4px ${active ? colors.text : 'transparent'}`,
                }}
              />
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Txt size={13} color="muted">
          Profil fotoğrafı
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {softButton('Fotoğraf yükle', async () => {
            const img = await pickImage([1, 1]);
            if (img) setNewAvatar(img);
          })}
          {!!avatarPreview && (
            <Press
              onPress={() => {
                setAvatarUrl(null);
                setNewAvatar(null);
              }}
              style={{ borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 }}
            >
              <Txt size={14} weight={600} color="muted">
                Kaldır
              </Txt>
            </Press>
          )}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row' }}>
          <Txt size={13} color="muted" style={{ flex: 1 }}>
            Hakkında
          </Txt>
          <Txt size={12.5} color="faint" style={{ fontVariant: ['tabular-nums'] }}>
            {bio.length}/{BIO_MAX}
          </Txt>
        </View>
        <Field
          label="Hakkında"
          value={bio}
          onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
          multiline
          minHeight={76}
          placeholder="Ne yaparsın, neyle uğraşıyorsun?"
        />
      </View>

      <View style={{ gap: 8 }}>
        <Txt size={13} color="muted">
          Linkler
        </Txt>
        {links.map((l, i) => (
          <Box
            key={`${l.url}-${i}`}
            bg="surface2"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 8, paddingLeft: 14 }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt size={14} weight={700}>
                {l.label}
              </Txt>
              <Txt size={12.5} color="muted" numberOfLines={1}>
                {l.url}
              </Txt>
            </View>
            <Press
              onPress={() => setLinks(links.filter((_, j) => j !== i))}
              accessibilityLabel="Linki kaldır"
              bg="chip"
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" size={16} color={colors.text} strokeWidth={2.2} />
            </Press>
          </Box>
        ))}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field
            label="Link adı"
            value={linkLabel}
            onChangeText={setLinkLabel}
            placeholder="Ad (örn. Instagram)"
            style={{ width: '38%', minWidth: 0, borderRadius: 14, fontSize: 14, paddingVertical: 11, paddingHorizontal: 12 }}
          />
          <Field
            label="Link adresi"
            value={linkUrl}
            onChangeText={setLinkUrl}
            onSubmitEditing={addLink}
            placeholder="Adres"
            autoCapitalize="none"
            inputMode="url"
            style={{ flex: 1, minWidth: 0, borderRadius: 14, fontSize: 14, paddingVertical: 11, paddingHorizontal: 12 }}
          />
          <IconButton icon="plus" label="Linki ekle" onPress={addLink} size={44} />
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Txt weight={700}>Sessiz saatler</Txt>
            <Txt size={13} color="muted">
              Bu saatlerde sohbet bildirimleri telefonuna gelmez; uygulamada birikir, istediğin zaman bakarsın.
            </Txt>
          </View>
          <Switch label="Sessiz saatler" value={quiet} onChange={setQuiet} />
        </View>
        {quiet && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Select label="Sessiz saat başlangıcı" value={quietStart} options={HOURS} onChange={setQuietStart} minWidth={110} />
            <Txt color="muted">ile</Txt>
            <Select label="Sessiz saat bitişi" value={quietEnd} options={HOURS} onChange={setQuietEnd} minWidth={110} />
            <Txt color="muted">arası</Txt>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SubmitButton label="Kaydet" doneLabel="Kaydedildi" size="lg" block onSubmit={save} style={{ flex: 1 }} />
        <Button label="Vazgeç" size="lg" kind="soft" onPress={onClose} />
      </View>
    </View>
  );
}
