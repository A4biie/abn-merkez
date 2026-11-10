import { Platform, View } from 'react-native';

import { AvatarStack } from '@/components/Social';
import { PresenceAvatar } from '@/components/profile/ProfileCard';
import { Box } from '@/components/ui/Box';
import { Icon } from '@/components/ui/Icon';
import { PendingBadge } from '@/components/ui/PendingBadge';
import { Press } from '@/components/ui/Press';
import { openProfile } from '@/lib/profileModal';
import { Txt } from '@/components/ui/Txt';
import { previewText, splitMentions, type Message } from '@/lib/chat';
import { useTeam } from '@/lib/team';
import { useTheme } from '@/theme/ThemeProvider';
import { StoredImage, VoiceMessage } from './Attachments';

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Tek mesaj. Kendi mesajın sağda ve lila; başkasınınki solda. Arka arkaya gelen mesajlarda
 * ad ve avatar tekrar edilmez (grouped). Uzun basınca işlem paneli açılır.
 */
export function MessageBubble({
  message,
  replied,
  grouped,
  showAuthor,
  onLongPress,
  onToggleHeart,
}: {
  message: Message;
  replied?: Message;
  grouped: boolean;
  showAuthor: boolean;
  onLongPress: () => void;
  onToggleHeart: () => void;
}) {
  const { colors } = useTheme();
  const team = useTeam();
  const mine = message.author_id === team.meId;
  const author = team.person(message.author_id);
  const deleted = !!message.deleted_at;
  const ink = mine ? colors['a2-ink'] : colors.text;
  const likers = message.message_hearts.map((h) => team.person(h.user_id)).filter((p) => !!p);
  const liked = message.message_hearts.some((h) => h.user_id === team.meId);
  const usernames = new Set([...team.people.values()].map((p) => p.username));

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: mine ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        gap: 8,
        marginTop: grouped ? 2 : 10,
      }}
    >
      {!mine && showAuthor && (
        <View style={{ width: 30 }}>{!grouped && author && (
            <Press onPress={() => openProfile(author.id)} accessibilityLabel={author.full_name + ' profili'}>
              <PresenceAvatar person={author} size={30} isMe={false} ring={colors.bg} />
            </Press>
          )}</View>
      )}
      <View style={{ maxWidth: '78%', alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
        {!mine && showAuthor && !grouped && (
          <Press onPress={() => openProfile(author?.id)} pressScale={1}>
            <Txt size={12.5} weight={700} color="muted" style={[{ marginLeft: 4 }, author?.accent_color ? { color: author.accent_color } : null]}>
              {author?.full_name ?? 'Eski üye'}
            </Txt>
          </Press>
        )}
        <Press
          onLongPress={deleted ? undefined : onLongPress}
          // Bilgisayarda basılı tutmak zahmetli; tıklamak da aynı paneli açar.
          onPress={deleted || Platform.OS !== 'web' ? undefined : onLongPress}
          delayLongPress={350}
          pressScale={0.98}
          bg={deleted ? 'surface2' : mine ? 'a2' : 'surface'}
          accessibilityLabel={deleted ? 'Silinmiş mesaj' : Platform.OS === 'web' ? 'Mesaj. İşlemler için tıkla.' : 'Mesaj. İşlemler için basılı tut.'}
          accessibilityHint="Yanıtla, kalp bırak, göreve çevir"
          style={{
            borderRadius: 20,
            borderBottomRightRadius: mine && !grouped ? 6 : 20,
            borderBottomLeftRadius: !mine && !grouped ? 6 : 20,
            paddingVertical: 9,
            paddingHorizontal: 13,
            gap: 6,
          }}
        >
          {replied && !deleted && (
            <View style={{ borderLeftWidth: 3, borderLeftColor: ink, paddingLeft: 8, opacity: 0.75 }}>
              <Txt size={12} weight={700} style={{ color: ink }}>
                {team.nameOf(replied.author_id)}
              </Txt>
              <Txt size={12.5} numberOfLines={2} style={{ color: ink }}>
                {previewText(replied)}
              </Txt>
            </View>
          )}
          {deleted ? (
            <Txt size={14} color="muted" style={{ fontStyle: 'italic' }}>
              Mesaj silindi
            </Txt>
          ) : (
            <>
              {message.attachment_kind === 'gorsel' && message.attachment_path && (
                <StoredImage
                  path={message.attachment_path}
                  bucket="chat-files"
                  width={220}
                  height={165}
                  radius={12}
                />
              )}
              {message.attachment_kind === 'ses' && message.attachment_path && (
                <VoiceMessage path={message.attachment_path} ms={message.attachment_ms} ink={ink} />
              )}
              {!!message.body && (
                <Txt size={15} style={{ color: ink }}>
                  {splitMentions(message.body).map((p, i) =>
                    p.mention && usernames.has(p.mention) ? (
                      <Txt
                        key={i}
                        size={15}
                        weight={700}
                        style={{ color: mine ? ink : colors['accent-text'] }}
                      >
                        {p.text}
                      </Txt>
                    ) : (
                      p.text
                    ),
                  )}
                </Txt>
              )}
            </>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
            {(message.pending || message.sentFromQueue) && (
              <PendingBadge sent={message.sentFromQueue} color={ink} />
            )}
            <Txt size={11} style={{ color: ink, opacity: 0.6 }}>
              {message.edited_at && !deleted ? 'düzenlendi · ' : ''}
              {clock(message.created_at)}
            </Txt>
          </View>
        </Press>
        {likers.length > 0 && (
          <Press
            onPress={onToggleHeart}
            accessibilityLabel={liked ? 'Kalbini geri al' : 'Sen de kalp bırak'}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -2 }}
          >
            <Box
              bg="surface2"
              style={{ borderRadius: 999, padding: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Icon name="heart" size={12} color={colors.heart} fill={colors.heart} />
              <AvatarStack people={likers} size={18} max={5} ring="bg" />
            </Box>
          </Press>
        )}
      </View>
    </View>
  );
}
