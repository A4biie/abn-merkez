// Dosyalar (0.11 bölüm 5): sohbet, pano ve wiki'deki dosyalar tek listede (list_files()).

import { supabase } from './supabase';
import { invalidate, useQuery } from './useQuery';

export type FileKind = 'gorsel' | 'ses' | 'video' | 'belge';
export type FileRow = {
  bucket: string;
  path: string;
  name: string;
  mime: string | null;
  size: number | null;
  created_at: string;
  uploaded_by: string | null;
  source: 'sohbet' | 'pano' | 'wiki' | 'bug';
  source_label: string;
  source_id: string | null;
  source_ref: string | null;
};

export async function fetchFiles() {
  const { data, error } = await supabase.rpc('list_files');
  if (error) throw error;
  return ((data ?? []) as FileRow[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export const useFiles = () => useQuery('files', fetchFiles);

export function kindOf(f: Pick<FileRow, 'mime' | 'path'>): FileKind {
  const m = f.mime ?? '';
  const ext = extOf(f.path).toLowerCase();
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'gorsel';
  if (m.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'webm', 'aac'].includes(ext)) return 'ses';
  if (m.startsWith('video/') || ['mp4', 'mov', 'mkv'].includes(ext)) return 'video';
  return 'belge';
}

export const extOf = (path: string) => (path.includes('.') ? path.split('.').pop()! : '');

export function sizeLabel(bytes: number | null | undefined) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  return (bytes / 1024 ** 3).toFixed(2) + ' GB';
}

const urls = new Map<string, Promise<string>>();
/** Gizli kovalar için 1 saatlik imzalı adres (önbellekli). */
export function fileUrl(f: Pick<FileRow, 'bucket' | 'path'>, download = false) {
  const key = f.bucket + '/' + f.path + (download ? ':d' : '');
  let u = urls.get(key);
  if (!u) {
    u = supabase.storage
      .from(f.bucket)
      .createSignedUrl(f.path, 3600, download ? { download: true } : undefined)
      .then((r) => r.data?.signedUrl ?? '');
    urls.set(key, u);
    setTimeout(() => urls.delete(key), 50 * 60_000);
  }
  return u;
}

/** Dosyayı kaynağıyla birlikte siler (mesaj eki / pano kartı), sonra Storage'dan. */
export async function deleteFile(f: FileRow) {
  const { error } = await supabase.rpc('delete_file_source', { p_bucket: f.bucket, p_path: f.path });
  if (error) throw error;
  const { error: e2 } = await supabase.storage.from(f.bucket).remove([f.path]);
  invalidate('files', 'boards', 'chatRooms', 'messages');
  if (e2) throw e2;
}
