import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { StoredImage } from '@/components/chat/Attachments';
import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Button } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { friendlyError } from '@/lib/errors';
import { closePoll, pollEnded, remainingLabel, usePollResults, vote } from '@/lib/polls';
import { useTeam } from '@/lib/team';
import type { Post } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Oylama postunun gövdesi: seçenekler, oy verme ve yüzde çubukları. İsimli oylamada çubuğa
 * basınca kimin seçtiği açılır. Sonuçlar ayara göre oy verince ya da oylama bitince görünür.
 */
export function PollView({ post }: { post: Post }) {
  const { colors } = useTheme();
  const say = useToast();
  const team = useTeam();
  const poll = post.polls!;
  const options = post.poll_options ?? [];
  const results = usePollResults(post.id);
  const rows = new Map((results.data ?? []).map((r) => [r.option_id, r]));
  const visible = !!results.data?.[0]?.visible;
  const total = results.data?.[0]?.total_voters ?? 0;
  const mine = options.filter((o) => rows.get(o.id)?.mine).map((o) => o.id);
  const voted = mine.length > 0;
  const ended = pollEnded(poll);
  const canManage = post.author_id === team.meId || team.isAdmin;

  const [changing, setChanging] = useState(false);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [openVoters, setOpenVoters] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selection = picked ?? mine;
  const choosing = !ended && (!voted || changing);

  function toggle(id: string) {
    setPicked((prev) => {
      const cur = prev ?? mine;
      if (!poll.multiple) return [id];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });
  }

  async function submit() {
    if (!selection.length) {
      say(poll.multiple ? 'En az bir seçenek seç' : 'Bir seçenek seç');
      return;
    }
    setBusy(true);
    const error = await vote(post.id, selection);
    setBusy(false);
    if (error) {
      say(friendlyError(error));
      return;
    }
    setChanging(false);
    setPicked(null);
    say(voted ? 'Oyun güncellendi' : 'Oyun kaydedildi');
  }

  async function finish() {
    setBusy(true);
    const error = await closePoll(post.id);
    setBusy(false);
    say(error ? friendlyError(error) : 'Oylama bitti; oy verenlere haber gitti');
  }

  function announce() {
    const counted = options.map((o) => ({ o, n: rows.get(o.id)?.votes ?? 0 }));
    const max = Math.max(0, ...counted.map((c) => c.n));
    const winners = counted.filter((c) => c.n === max && max > 0).map((c) => c.o.body);
    const title = winners.length ? `Oylama sonucu: ${winners.join(' ve ')}` : 'Oylama sonucu';
    const body = `“${post.body}” oylaması bitti. ${winners.length ? `En çok oyu ${winners.join(' ve ')} aldı.` : 'Hiç oy verilmedi.'}`;
    router.navigate({ pathname: '/yonetim', params: { sekme: 'duyuru', baslik: title, metin: body } });
  }

  const meta = [
    poll.multiple ? 'Çoklu seçim' : 'Tek seçim',
    poll.anonymous ? 'İsimsiz' : 'İsimli',
    remainingLabel(poll),
  ].join(' · ');

  return (
    <View style={{ gap: 10 }}>
      <Txt size={12.5} color="muted">
        {meta}
      </Txt>
      {options.map((o) => {
        const r = rows.get(o.id);
        const pct = visible && total ? Math.round(((r?.votes ?? 0) / total) * 100) : 0;
        const selected = selection.includes(o.id);
        const voters = r?.voters ?? null;
        const showBar = visible && !choosing;
        return (
          <View key={o.id} style={{ gap: 6 }}>
            <Press
              onPress={() =>
                choosing
                  ? toggle(o.id)
                  : voters?.length
                    ? setOpenVoters((v) => (v === o.id ? null : o.id))
                    : undefined
              }
              disabled={!choosing && !voters?.length}
              pressScale={0.98}
              bg="surface2"
              accessibilityRole={choosing ? (poll.multiple ? 'checkbox' : 'radio') : 'button'}
              accessibilityState={{ checked: choosing ? selected : undefined, selected: r?.mine }}
              accessibilityLabel={`${o.body}${showBar ? `, yüzde ${pct}` : ''}${r?.mine ? ', senin seçimin' : ''}`}
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1.5,
                borderColor: choosing && selected ? colors.a2 : 'transparent',
              }}
            >
              {showBar && (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    backgroundColor: r?.mine ? colors.a2 : colors.chip,
                    opacity: r?.mine ? 0.55 : 1,
                  }}
                />
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}>
                {choosing && (
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: poll.multiple ? 7 : 11,
                      borderWidth: 2,
                      borderColor: colors.a2,
                      backgroundColor: selected ? colors.a2 : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected && <Icon name="check" size={13} color={colors['a2-ink']} strokeWidth={3} />}
                  </View>
                )}
                {o.image_path && (
                  <StoredImage path={o.image_path} bucket="post-files" width={64} height={64} radius={12} />
                )}
                <Txt weight={600} style={{ flex: 1 }}>
                  {o.body}
                </Txt>
                {!choosing && r?.mine && (
                  <Icon name="check" size={16} color={colors.text} strokeWidth={2.6} />
                )}
                {showBar && (
                  <Txt size={14} weight={700} style={{ fontVariant: ['tabular-nums'] }}>
                    %{pct}
                  </Txt>
                )}
              </View>
            </Press>
            {openVoters === o.id && voters && (
              <Box
                bg="surface2"
                style={{ borderRadius: 14, padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
              >
                {voters.map((id) => {
                  const p = team.person(id);
                  return (
                    <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {p && <Avatar person={p} size={22} />}
                      <Txt size={13}>{id === team.meId ? 'Sen' : team.nameOf(id)}</Txt>
                    </View>
                  );
                })}
              </Box>
            )}
          </View>
        );
      })}

      <Txt size={13} color="muted">
        {visible
          ? total === 0
            ? 'Henüz oy yok.'
            : `${total} kişi oy verdi${poll.anonymous ? '' : '. Kimin seçtiğini görmek için çubuğa dokun.'}`
          : ended
            ? ''
            : poll.show_results === 'bitince'
              ? 'Sonuçlar oylama bitince görünecek.'
              : 'Oy verince sonuçları görürsün.'}
      </Txt>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {choosing && (
          <Button
            label={busy ? 'Kaydediliyor…' : voted ? 'Oyumu güncelle' : 'Oy ver'}
            onPress={submit}
            disabled={busy}
          />
        )}
        {changing && (
          <Button
            label="Vazgeç"
            kind="soft"
            onPress={() => {
              setChanging(false);
              setPicked(null);
            }}
          />
        )}
        {!ended && voted && !changing && (
          <Button label="Oyumu değiştir" kind="soft" onPress={() => setChanging(true)} />
        )}
        {!ended && canManage && (
          <Button label="Oylamayı bitir" kind="muted" onPress={finish} disabled={busy} />
        )}
        {ended && team.isAdmin && (
          <Button label="Sonucu duyuru yap" kind="accent" icon="pin" onPress={announce} />
        )}
      </View>
    </View>
  );
}
