// Oylama veri katmanı (supabase/migrations/20261102000700_polls.sql).
// Oylar tabloya doğrudan yazılmaz ve okunmaz: oy poll_vote(), sonuç poll_results() ile.

import { uuid } from './board';
import { pickedImageBody, type PickedImage } from './queries';
import { supabase } from './supabase';
import type { Poll } from './types';
import { invalidate, useQuery } from './useQuery';

export type PollResult = {
  option_id: string;
  /** Sonuç henüz gösterilmiyorsa null. */
  votes: number | null;
  /** Sadece isimli oylamada ve sonuç görünürken dolu. */
  voters: string[] | null;
  mine: boolean;
  total_voters: number | null;
  visible: boolean;
};

export async function fetchPollResults(postId: string) {
  const { data, error } = await supabase.rpc('poll_results', { p_posts: [postId] });
  if (error) throw error;
  return data as PollResult[];
}
export const usePollResults = (postId: string) => useQuery(`polls:${postId}`, () => fetchPollResults(postId));

export function pollEnded(poll: Pick<Poll, 'closed_at' | 'ends_at'>, now = Date.now()) {
  return !!poll.closed_at || (!!poll.ends_at && new Date(poll.ends_at).getTime() <= now);
}

export async function vote(postId: string, optionIds: string[]) {
  const { error } = await supabase.rpc('poll_vote', { p_post: postId, p_options: optionIds });
  invalidate(`polls:${postId}`);
  return error;
}

export async function closePoll(postId: string) {
  const { error } = await supabase.rpc('poll_close', { p_post: postId });
  invalidate(`polls:${postId}`, 'feed');
  return error;
}

export type PollDraftOption = { body: string; image: PickedImage | null };

export async function createPoll(input: {
  userId: string;
  question: string;
  projectId: string | null;
  options: PollDraftOption[];
  multiple: boolean;
  anonymous: boolean;
  endsAt: Date | null;
  showResults: 'oy_verince' | 'bitince';
}) {
  // Görseller önce yüklenir; oylama tek seferde (create_poll) açılır.
  const options = [];
  for (const o of input.options) {
    let image_path: string | null = null;
    if (o.image) {
      const { body, type, ext } = await pickedImageBody(o.image);
      image_path = `${input.userId}/${uuid()}.${ext}`;
      const { error } = await supabase.storage
        .from('post-files')
        .upload(image_path, body, { contentType: type });
      if (error) throw error;
    }
    options.push({ body: o.body.trim(), image_path });
  }
  const { error } = await supabase.rpc('create_poll', {
    p_question: input.question.trim(),
    p_project: input.projectId,
    p_options: options,
    p_multiple: input.multiple,
    p_anonymous: input.anonymous,
    p_ends_at: input.endsAt?.toISOString() ?? null,
    p_show_results: input.showResults,
  });
  invalidate('feed');
  if (error) throw error;
}

/** "2 gün kaldı", "3 saat kaldı", "Bitti". */
export function remainingLabel(poll: Pick<Poll, 'closed_at' | 'ends_at'>, now = Date.now()) {
  if (pollEnded(poll, now)) return 'Bitti';
  if (!poll.ends_at) return 'Süresiz';
  const ms = new Date(poll.ends_at).getTime() - now;
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return 'Bir saatten az kaldı';
  if (h < 24) return `${h} saat kaldı`;
  return `${Math.round(h / 24)} gün kaldı`;
}
