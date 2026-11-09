import { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { editMessage, previewText, sendMessage, uploadChatFile, type Message } from '@/lib/chat';
import { friendlyError } from '@/lib/errors';
import { pickImage, readLocalFile } from '@/lib/media';
import { pickedImageBody } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { formatMs, useVoiceRecorder } from './Attachments';

/** Yazının sonundaki "@kel" parçası (anma önerisi için). */
function mentionQuery(text: string) {
  const m = /(^|\s)@([^\s@]*)$/.exec(text);
  return m ? m[2].toLocaleLowerCase('tr') : null;
}

export function Composer({
  roomId,
  memberIds,
  replyTo,
  editing,
  onDone,
}: {
  roomId: string;
  memberIds: string[];
  replyTo: Message | null;
  editing: Message | null;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const say = useToast();
  const team = useTeam();
  const voice = useVoiceRecorder();
  // Düzenleme moduna girip çıkınca bileşen yeniden kurulur (ChatRoom'daki key), metin buradan başlar.
  const [text, setText] = useState(editing?.body ?? '');
  const [busy, setBusy] = useState(false);

  const query = mentionQuery(text);
  const suggestions =
    query === null
      ? []
      : memberIds
          .filter((id) => id !== team.meId)
          .map((id) => team.person(id))
          .filter((p) => !!p)
          .filter((p) => p.username.startsWith(query) || p.full_name.toLocaleLowerCase('tr').includes(query))
          .slice(0, 5);

  function pickMention(username: string) {
    setText((t) => t.replace(/@([^\s@]*)$/, `@${username} `));
  }

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const error = editing
      ? await editMessage(editing, body)
      : await sendMessage({ roomId, userId: team.meId, body, replyTo: replyTo?.id });
    setBusy(false);
    if (error) {
      say(friendlyError(error));
      return;
    }
    setText('');
    onDone();
  }

  async function sendImage() {
    try {
      const image = await pickImage();
      if (!image) return;
      setBusy(true);
      const { body, type, ext } = await pickedImageBody(image);
      const path = await uploadChatFile(roomId, body, ext, type);
      const error = await sendMessage({
        roomId,
        userId: team.meId,
        body: text.trim(),
        replyTo: replyTo?.id,
        attachment: { path, kind: 'gorsel' },
      });
      if (error) throw error;
      setText('');
      onDone();
    } catch (e) {
      say(friendlyError(e, 'Görsel gönderilemedi. Biraz sonra tekrar dene.'));
    } finally {
      setBusy(false);
    }
  }

  async function startVoice() {
    const problem = await voice.start();
    if (problem === 'izin') say('Sesli mesaj için mikrofon izni gerekiyor. Ayarlardan açabilirsin.');
  }

  async function stopVoice() {
    if (!voice.recording) return;
    const rec = await voice.stop();
    if (!rec) {
      say('Kayıt çok kısa oldu. Basılı tutup konuş, bırakınca gider.');
      return;
    }
    try {
      setBusy(true);
      const body = await readLocalFile(rec.uri);
      const path = await uploadChatFile(roomId, body, 'm4a', 'audio/mp4');
      const error = await sendMessage({
        roomId,
        userId: team.meId,
        body: '',
        replyTo: replyTo?.id,
        attachment: { path, kind: 'ses', ms: Math.round(rec.ms) },
      });
      if (error) throw error;
      onDone();
    } catch (e) {
      say(friendlyError(e, 'Sesli mesaj gönderilemedi. Biraz sonra tekrar dene.'));
    } finally {
      setBusy(false);
    }
  }

  const banner = editing
    ? 'Mesajı düzenliyorsun'
    : replyTo
      ? `${team.nameOf(replyTo.author_id)} kişisine yanıt`
      : null;
  const canVoice = Platform.OS !== 'web' && !editing;
  const hasText = text.trim().length > 0;

  return (
    <View style={{ gap: 8 }}>
      {suggestions.length > 0 && (
        <Box bg="surface" shadow style={{ borderRadius: 18, padding: 6 }}>
          {suggestions.map((p) => (
            <Press
              key={p.id}
              onPress={() => pickMention(p.username)}
              hoverBg="hover"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12 }}
            >
              <Avatar person={p} size={28} />
              <Txt weight={600}>{p.full_name}</Txt>
              <Txt size={13} color="muted">
                @{p.username}
              </Txt>
            </Press>
          ))}
        </Box>
      )}
      {banner && (
        <Box
          bg="surface2"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 10 }}
        >
          <Icon name={editing ? 'edit' : 'reply'} size={16} color={colors['accent-text']} strokeWidth={2} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={12.5} weight={700}>
              {banner}
            </Txt>
            {replyTo && !editing && (
              <Txt size={12.5} color="muted" numberOfLines={1}>
                {previewText(replyTo)}
              </Txt>
            )}
          </View>
          <Press
            onPress={() => {
              setText('');
              onDone();
            }}
            accessibilityLabel="Vazgeç"
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="close" size={14} color={colors.text} strokeWidth={2.2} />
          </Press>
        </Box>
      )}
      {voice.recording ? (
        <Box
          bg="a1"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderRadius: 999,
            paddingVertical: 12,
            paddingHorizontal: 18,
          }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5484D' }} />
          <Txt weight={700} color="a1-ink" style={{ fontVariant: ['tabular-nums'] }}>
            {formatMs(voice.ms)}
          </Txt>
          <Txt size={13.5} color="a1-ink" style={{ flex: 1 }}>
            Bırakınca gider
          </Txt>
        </Box>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        {!editing && (
          <Press
            onPress={sendImage}
            disabled={busy}
            accessibilityLabel="Görsel gönder"
            bg="surface"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="image" size={20} color={colors['text-2']} />
          </Press>
        )}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Mesaj yaz… (@ ile birini an)"
          placeholderTextColor={colors.faint}
          multiline
          aria-label="Mesaj"
          onKeyPress={(e) => {
            // Bilgisayarda Enter gönderir, Shift+Enter yeni satır.
            const ne = e.nativeEvent as unknown as {
              key: string;
              shiftKey?: boolean;
              preventDefault?: () => void;
            };
            if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) {
              (e as unknown as { preventDefault: () => void }).preventDefault();
              send();
            }
          }}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 140,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingTop: 11,
            paddingBottom: 11,
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fontFamily(500),
            fontSize: 15,
          }}
        />
        {canVoice && !hasText ? (
          <Press
            onPressIn={startVoice}
            onPressOut={stopVoice}
            disabled={busy || voice.starting}
            accessibilityLabel="Sesli mesaj için basılı tut"
            bg={voice.recording ? 'a1' : 'a2'}
            pressScale={1.15}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name="mic"
              size={20}
              color={colors[voice.recording ? 'a1-ink' : 'a2-ink']}
              strokeWidth={2}
            />
          </Press>
        ) : (
          <Press
            onPress={send}
            disabled={busy || !hasText}
            accessibilityLabel={editing ? 'Kaydet' : 'Gönder'}
            bg={hasText ? 'a1' : 'surface2'}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={editing ? 'check' : 'send'}
              size={19}
              color={colors[hasText ? 'a1-ink' : 'faint']}
              strokeWidth={2}
            />
          </Press>
        )}
      </View>
    </View>
  );
}
