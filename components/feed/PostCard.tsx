import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useIsWide } from '@/components/layout/useIsWide';
import { AvatarStack, HeartButton } from '@/components/Social';
import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Card, Field } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { PendingBadge } from '@/components/ui/PendingBadge';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Txt } from '@/components/ui/Txt';
import { friendlyError } from '@/lib/errors';
import { addComment, setPinnedComment, toggleHeart, useTasks } from '@/lib/queries';
import { likeInfo, useTeam } from '@/lib/team';
import { timeAgo } from '@/lib/time';
import type { Comment, Post } from '@/lib/types';
import { css, EASE_OUT, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { PollView } from './PollView';
import { PostMedia } from './PostMedia';

/** Normal paylaşımlarda bu kadar yorum görünür; "Fikrinizi istiyorum" olanlarda hepsi. */
const COLLAPSED_COMMENTS = 2;

// Yenilemeyle yeni gelen paylaşım a3 zeminle girip normale döner.
const freshFade = css.keyframes({ from: { opacity: 0.6 }, to: { opacity: 0 } });

export function PostCard({ post, fresh }: { post: Post; fresh?: boolean }) {
  const { colors } = useTheme();
  const wide = useIsWide();
  const motion = useMotion();
  const say = useToast();
  const team = useTeam();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const author = team.person(post.author_id);
  const feedback = post.type === 'fikrinizi_istiyorum';
  const isOwner = post.author_id === team.meId;
  const project = post.project_id ? team.projectMap.get(post.project_id) : undefined;
  const likes = likeInfo(post.hearts, team.meId, team.nameOf);
  const likers = likes.ids.map((id) => team.person(id)).filter((p) => !!p);

  // Sabitlenen yorum en üstte; normal paylaşımda son iki yorum, istenirse hepsi.
  const pinned = post.comments.find((c) => c.id === post.pinned_comment_id);
  const rest = post.comments.filter((c) => c.id !== post.pinned_comment_id);
  const showAll = feedback || expanded;
  const visible = showAll ? rest : rest.slice(-COLLAPSED_COMMENTS);
  const hidden = rest.length - visible.length;

  /** SubmitButton için: hata metni ya da null. */
  async function send() {
    const body = draft.trim();
    if (!body) return 'Önce bir yorum yaz.';
    const error = await addComment(post.id, team.meId, body);
    if (error) return friendlyError(error);
    setDraft('');
    return null;
  }

  // Klavyedeki "gönder" tuşu: hata olursa kısa bir uyarı.
  async function sendFromKeyboard() {
    if (sending || !draft.trim()) return;
    setSending(true);
    const error = await send();
    setSending(false);
    if (error) say(error);
  }

  async function togglePin(c: Comment) {
    const next = post.pinned_comment_id === c.id ? null : c.id;
    const error = await setPinnedComment(post.id, next);
    if (error) say(friendlyError(error));
    else say(next ? 'Yorum sabitlendi' : 'Sabitleme kaldırıldı');
  }

  async function heart() {
    const error = await toggleHeart('post', post.id, team.meId, likes.liked);
    if (error) say(friendlyError(error));
  }

  const comment = (c: Comment, isPinned: boolean) => (
    <Box
      key={c.id}
      bg="surface2"
      style={{
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      {isPinned && (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: '#0E0E10',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel="Sabitlenmiş yorum"
        >
          <Icon name="pin" size={12} color="#E4F68F" strokeWidth={2.4} />
        </View>
      )}
      <Txt size={14} style={{ flex: 1 }}>
        <Txt size={14} weight={700}>
          {team.nameOf(c.author_id)}
        </Txt>{' '}
        {c.body}
      </Txt>
      {isOwner && (
        <Press
          onPress={() => togglePin(c)}
          accessibilityLabel={isPinned ? 'Sabitlemeyi kaldır' : 'Yorumu sabitle'}
          hoverBg="hover"
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            marginVertical: -2,
          }}
        >
          <Icon
            name="pin"
            size={14}
            color={isPinned ? colors['accent-text'] : colors.faint}
            strokeWidth={2}
          />
        </Press>
      )}
    </Box>
  );

  return (
    <Card
      radius={26}
      padding={wide ? 18 : 16}
      style={feedback ? { borderWidth: 1.5, borderColor: colors.a2 } : undefined}
    >
      {fresh && !motion.reduced && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 26,
            backgroundColor: colors.a3,
            animationName: freshFade,
            animationDuration: 1400,
            animationDelay: 300,
            animationTimingFunction: EASE_OUT,
            animationFillMode: 'both',
          }}
        />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Press
          onPress={() => router.navigate({ pathname: '/profil/[id]', params: { id: post.author_id } })}
          accessibilityLabel={`${author?.full_name ?? 'Kişi'} profilini aç`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}
        >
          {author && <Avatar person={author} size={wide ? 40 : 38} />}
          <View style={{ minWidth: 0 }}>
            <Txt weight={700}>{author?.full_name ?? 'Biri'}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt size={12.5} color="muted">
                {timeAgo(post.created_at)}
              </Txt>
              {(post.pending || post.sentFromQueue) && <PendingBadge sent={post.sentFromQueue} />}
            </View>
          </View>
        </Press>
        {feedback && (
          <Box bg="a2" style={{ borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 }}>
            <Txt size={12} weight={700} color="a2-ink" leading={1.2}>
              Fikrinizi istiyor
            </Txt>
          </Box>
        )}
        {post.type === 'oylama' && (
          <Box bg="a3" style={{ borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 }}>
            <Txt size={12} weight={700} color="a3-ink" leading={1.2}>
              Oylama
            </Txt>
          </Box>
        )}
      </View>

      {!!(project || post.task_id) && <PostTag post={post} />}
      {!!post.body && (
        <Txt
          size={wide ? (post.polls ? 17 : 15.5) : post.polls ? 16.5 : 15}
          weight={post.polls ? 700 : 400}
          style={wide ? { maxWidth: 620 } : undefined}
        >
          {post.body}
        </Txt>
      )}
      {post.type === 'oylama' && post.polls && <PollView post={post} />}
      {post.media.map((m, i) => (
        <PostMedia key={i} media={m} />
      ))}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <HeartButton liked={likes.liked} onPress={heart} />
        {likers.length > 0 && <AvatarStack people={likers} size={24} />}
        <Txt size={13} color="muted" style={{ marginLeft: likers.length ? 6 : 0, flexShrink: 1 }}>
          {likes.text || 'İlk kalbi sen bırak'}
        </Txt>
      </View>

      {pinned && comment(pinned, true)}
      {hidden > 0 && (
        <Press onPress={() => setExpanded(true)} style={{ alignSelf: 'flex-start' }}>
          <Txt size={13.5} weight={600} color="muted">
            Önceki yorumları gör
          </Txt>
        </Press>
      )}
      {visible.map((c) => comment(c, false))}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field
          label="Yorum yaz"
          round
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={sendFromKeyboard}
          returnKeyType="send"
          placeholder={feedback ? 'Fikrini yaz…' : 'Yorum yaz…'}
          style={{ flex: 1, minWidth: 0, fontSize: 14 }}
        />
        <SubmitButton label="Gönder" doneLabel="Gönderildi" onSubmit={send} disabled={!draft.trim()} />
      </View>
    </Card>
  );
}

/** "PaleMouth · Ana karakter yüz ifadeleri" satırı. */
function PostTag({ post }: { post: Post }) {
  const team = useTeam();
  const project = post.project_id ? team.projectMap.get(post.project_id)?.name : undefined;
  const task = useTaskTitle(post.task_id);
  const text = [project, task].filter(Boolean).join(' · ');
  if (!text) return null;
  return (
    <Txt size={12.5} weight={600} color="accent-text">
      {text}
    </Txt>
  );
}

function useTaskTitle(taskId: string | null) {
  const { data } = useTasks();
  return taskId ? data?.find((t) => t.id === taskId)?.title : undefined;
}
