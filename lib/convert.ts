// Mesajı göreve / fikre çevirme (0.11 bölüm 3). Görev formu bir pencerede açılır (ConvertTaskModal).

import { useSyncExternalStore } from 'react';

import type { Message } from './chat';
import { supabase } from './supabase';
import type { TaskStatus } from './types';
import { invalidate } from './useQuery';

/** İlk cümle, en fazla 60 karakter; baştaki "Fikir:" / "Bug:" atılır (design/abn-09.html guessTitle). */
export function guessTitle(text: string): string {
  const t = text.replace(/^\s*(fikir|bug)\s*:\s*/i, '').trim();
  const s = (t.split(/[.!?\n]/)[0] ?? t).trim();
  return s.length > 60 ? s.slice(0, 57).trimEnd() + '…' : s;
}

let current: { message: Message; projectId: string | null } | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function openConvertTask(message: Message, projectId: string | null) {
  current = { message, projectId };
  emit();
}
export function closeConvertTask() {
  current = null;
  emit();
}
export function useConvertTask() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
    () => null,
  );
}

export async function createTaskFromMessage(input: {
  message: Message;
  title: string;
  assignee: string | null;
  status: TaskStatus;
  projectId: string | null;
  dueLabel: string;
  dueDate: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_task_from_message', {
    p_message: input.message.id,
    p_title: input.title,
    p_assignee: input.assignee,
    p_status: input.status,
    p_project: input.projectId,
    p_due_label: input.dueLabel,
    p_due_date: input.dueDate,
  });
  if (error) throw error;
  invalidate('tasks');
  return data as string;
}

export async function ideaFromMessage(message: Message, userId: string, projectId: string | null) {
  const { error } = await supabase.from('ideas').insert({
    author_id: userId,
    body: message.body.trim(),
    project_id: projectId,
    source_message_id: message.id,
    source_author_id: message.author_id,
  });
  invalidate('ideas');
  return error;
}

/** Son tarih seçenekleri (tasarımdaki gibi): Bugün / Yarın / Cuma / Yok. */
export function dueOption(v: 'bugun' | 'yarin' | 'cuma' | 'yok'): { label: string; date: string | null } {
  if (v === 'yok') return { label: '', date: null };
  const d = new Date();
  if (v === 'yarin') d.setDate(d.getDate() + 1);
  if (v === 'cuma') d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { label: v === 'bugun' ? 'Bugün' : v === 'yarin' ? 'Yarın' : 'Cuma', date: iso };
}
