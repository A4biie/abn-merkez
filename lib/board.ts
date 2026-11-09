// Panolar (Board.dc.html): tipler, kart boyu tahmini, okuma/yazma ve canlı güncelleme.

import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from './supabase';
import { invalidate, useQuery } from './useQuery';

export type Tint = 'surface' | 'a1' | 'a2' | 'a3';

export type ItemType =
  | 'heading'
  | 'note'
  | 'todo'
  | 'image'
  | 'color'
  | 'link'
  | 'board'
  | 'zone'
  | 'sketch'
  | 'table'
  | 'quote'
  | 'file'
  | 'video';

export type BoardItem = {
  id: string;
  board_id: string;
  type: ItemType;
  x: number;
  y: number;
  w: number;
  h: number | null;
  color: Tint;
  z: number;
  data: ItemData;
  updated_at?: string;
};

/**
 * Kart verisi (board_items.data). Alanlar karta göre değişir:
 *   heading/note: text · todo: text, todos · color: text, swatches · link/video: text, url
 *   board: text, board_id · zone: text · sketch: strokes · table: rows · quote: text, author
 *   image: text, art | path · file: text (dosya adı), path, size, mime
 * path, gizli "board-files" kovasındaki yol: "<pano id>/<dosya>".
 */
export type ItemData = {
  text?: string;
  todos?: { text: string; done: boolean }[];
  swatches?: string[];
  url?: string;
  board_id?: string;
  art?: string;
  strokes?: number[][][];
  rows?: string[][];
  author?: string;
  path?: string;
  size?: number;
  mime?: string;
};

export type Cap = 'none' | 'dot' | 'arrow';

export type BoardLink = {
  id: string;
  board_id: string;
  from_item: string;
  to_item: string;
  start_cap: Cap;
  end_cap: Cap;
  dashed: boolean;
  bend_x: number;
  bend_y: number;
};

export type Board = {
  id: string;
  title: string;
  color: Tint;
  parent_board_id: string | null;
  project_id: string | null;
  created_at: string;
};

export type BoardWithItems = Board & { items: BoardItem[] };

/** Rastgele uuid (v4). Kartlar istemcide kimlik alır ki sürüklerken sunucuyu beklemesin. */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ───────────────────────── Kart boyu tahmini (prototipteki hOf) ─────────────────────────
// Gerçek boy ekranda ölçülür; bu tahmin ölçüm gelmeden önceki "Sığdır" ve önizleme için.

function lines(text: string, w: number) {
  return String(text || '')
    .split('\n')
    .reduce((n, p) => n + Math.max(1, Math.ceil((p.length * 7.6) / Math.max(60, w - 28))), 0);
}

export function estimateHeight(it: Pick<BoardItem, 'type' | 'w' | 'h' | 'data'>) {
  const d = it.data ?? {};
  switch (it.type) {
    case 'heading':
      return 60;
    case 'note':
      return 22 + lines(d.text ?? '', it.w) * 22 + 22;
    case 'todo':
      return 22 + 30 + (d.todos?.length ?? 0) * 32 + 52;
    case 'image':
      return 22 + (d.art || d.path ? 180 : 120) + 46;
    case 'sketch':
      return 22 + 200 + 6 + 28 + 10;
    case 'table':
      return 22 + (d.rows?.length ?? 1) * 34 + 1 + 6 + 28 + 10;
    case 'quote':
      return 22 + 30 + lines(d.text ?? '', it.w) * 24 + 6 + 4 + 20 + 14;
    case 'file':
      return 22 + 52 + (d.path ? 0 : 8 + 44) + 12;
    case 'video':
      return 22 + 150 + 6 + 24 + 6 + 20 + 10;
    case 'color':
      return 22 + 28 + Math.ceil((d.swatches?.length ?? 0) / 5) * 62 + 50;
    case 'link':
      return 22 + 96;
    case 'board':
      return 22 + 104;
    case 'zone':
      return it.h ?? 300;
    default:
      return it.h ?? 120;
  }
}

// ───────────────────────── Okuma ─────────────────────────

export async function fetchBoards() {
  const { data, error } = await supabase
    .from('boards')
    .select('*, items:board_items(id, type, x, y, w, h, color, data)')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as BoardWithItems[];
}

export async function fetchBoardItems(boardId: string) {
  const { data, error } = await supabase.from('board_items').select('*').eq('board_id', boardId).order('z');
  if (error) throw error;
  return (data ?? []) as BoardItem[];
}

export async function fetchBoardLinks(boardId: string) {
  const { data, error } = await supabase.from('board_links').select('*').eq('board_id', boardId);
  if (error) throw error;
  return (data ?? []) as BoardLink[];
}

export const useBoards = () => useQuery('boards', fetchBoards);

// ───────────────────────── Yazma ─────────────────────────

export async function createBoard(input: {
  title: string;
  color: Tint;
  userId: string;
  parentId?: string | null;
}) {
  const id = uuid();
  const { error } = await supabase.from('boards').insert({
    id,
    title: input.title,
    color: input.color,
    parent_board_id: input.parentId ?? null,
    created_by: input.userId,
  });
  invalidate('boards');
  if (error) throw error;
  return id;
}

export async function insertItem(item: BoardItem, userId: string) {
  const { error } = await supabase.from('board_items').insert({
    id: item.id,
    board_id: item.board_id,
    type: item.type,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    color: item.color,
    z: item.z,
    data: item.data,
    created_by: userId,
  });
  if (error) throw error;
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<BoardItem, 'x' | 'y' | 'w' | 'h' | 'color' | 'z' | 'data'>>,
) {
  const { error } = await supabase.from('board_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function renameBoard(id: string, title: string) {
  const { error } = await supabase.from('boards').update({ title }).eq('id', id);
  if (error) throw error;
  invalidate('boards');
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('board_items').delete().eq('id', id);
  if (error) throw error;
}

export async function insertLink(link: BoardLink, userId: string) {
  const { error } = await supabase.from('board_links').insert({ ...link, created_by: userId });
  if (error) throw error;
}

export async function updateLink(id: string, patch: Partial<Omit<BoardLink, 'id' | 'board_id'>>) {
  const { error } = await supabase.from('board_links').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteLink(id: string) {
  const { error } = await supabase.from('board_links').delete().eq('id', id);
  if (error) throw error;
}

// ───────────────────────── Dosyalar ─────────────────────────
// Görsel ve dosya kartları gizli "board-files" kovasını kullanır; okumak için kısa süreli imzalı adres alınır.

export async function uploadBoardFile(boardId: string, body: Blob | Uint8Array, name: string, mime: string) {
  const dot = name.lastIndexOf('.');
  const ext =
    dot > 0
      ? name
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : 'bin';
  const path = `${boardId}/${uuid()}.${ext || 'bin'}`;
  const { error } = await supabase.storage
    .from('board-files')
    .upload(path, body, { contentType: mime, upsert: false });
  if (error) throw error;
  return path;
}

const signed = new Map<string, { url: string; until: number }>();

/** Gizli kovadaki dosyanın 1 saatlik imzalı adresi (aynı yol için önbellekten). */
export async function signedUrl(path: string, bucket: 'board-files' | 'chat-files' | 'post-files' = 'board-files') {
  const key = `${bucket}/${path}`;
  const hit = signed.get(key);
  if (hit && hit.until > Date.now() + 60_000) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) throw error ?? new Error('Dosya açılamadı.');
  signed.set(key, { url: data.signedUrl, until: Date.now() + 3600_000 });
  return data.signedUrl;
}

// ───────────────────────── Canlı güncelleme ─────────────────────────

export type BoardChange =
  | { table: 'items'; type: 'upsert'; row: BoardItem }
  | { table: 'links'; type: 'upsert'; row: BoardLink }
  | { table: 'items' | 'links'; type: 'delete'; id: string };

/**
 * Aynı panoyu açan herkes kart ve bağlantı değişikliklerini canlı görür. Son yazan kazanır.
 * Silmede filtre çalışmadığı için board_id istemcide kontrol edilir (replica identity full).
 */
export function subscribeBoard(boardId: string, onChange: (c: BoardChange) => void): RealtimeChannel {
  const channel = supabase.channel(`pano:${boardId}`);
  for (const [table, key] of [
    ['board_items', 'items'],
    ['board_links', 'links'],
  ] as const) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `board_id=eq.${boardId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { id?: string; board_id?: string };
          if (old.id && (!old.board_id || old.board_id === boardId))
            onChange({ table: key, type: 'delete', id: old.id });
        } else if (key === 'items') {
          onChange({ table: 'items', type: 'upsert', row: payload.new as BoardItem });
        } else {
          onChange({ table: 'links', type: 'upsert', row: payload.new as BoardLink });
        }
      },
    );
  }
  return channel.subscribe();
}
