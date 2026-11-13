// Wiki (0.11 bölüm 4): sayfa ağacı, kaydetme (sürüm kontrollü), geçmiş, düzenleme işareti, görseller.

import { supabase } from './supabase';
import { invalidate, mutateCache, useQuery } from './useQuery';

export type WikiPage = {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  content: string;
  position: number;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  editing_by: string | null;
  editing_at: string | null;
};

export type WikiRevision = { id: string; version: number; title: string; content: string; edited_by: string | null; created_at: string };

export async function fetchWiki() {
  const { data, error } = await supabase.from('wiki_pages').select('*').order('position');
  if (error) throw error;
  return (data ?? []) as WikiPage[];
}
export const useWiki = () => useQuery('wiki', fetchWiki);

const patchCache = (id: string, patch: Partial<WikiPage>) =>
  mutateCache<WikiPage[]>('wiki', (prev) => (prev ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)));

export async function createPage(parentId: string | null, title = 'Yeni sayfa', icon = '') {
  const { data, error } = await supabase
    .from('wiki_pages')
    .insert({ parent_id: parentId, title, icon, content: '<p></p>', position: Date.now() / 1000 })
    .select('*')
    .single();
  if (error) throw error;
  mutateCache<WikiPage[]>('wiki', (prev) => [...(prev ?? []), data as WikiPage]);
  return data as WikiPage;
}

export class WikiConflict extends Error {
  constructor(public by: string | null) {
    super('wiki_conflict');
  }
}

/** Kaydeder; arada başkası kaydettiyse WikiConflict fırlatır. Dönüş yeni sürüm. */
export async function savePage(page: WikiPage, title: string, content: string, base: number) {
  const { data, error } = await supabase.rpc('save_wiki_page', { p_id: page.id, p_title: title, p_content: content, p_base: base });
  if (error) {
    if (error.message.includes('wiki_conflict')) throw new WikiConflict(error.details || null);
    throw error;
  }
  invalidate('wiki', `wikiRev:${page.id}`);
  return data as number;
}

export async function movePage(id: string, parentId: string | null, position: number) {
  patchCache(id, { parent_id: parentId, position });
  const { error } = await supabase.from('wiki_pages').update({ parent_id: parentId, position }).eq('id', id);
  invalidate('wiki');
  if (error) throw error;
}

export async function deletePage(id: string) {
  const { error } = await supabase.from('wiki_pages').delete().eq('id', id);
  invalidate('wiki');
  if (error) throw error;
}

/** "Düzenliyor" işareti: düzenlerken 30 sn'de bir yenilenir; bitince temizlenir. */
export async function markEditing(id: string, on: boolean, me: string) {
  await supabase
    .from('wiki_pages')
    .update(on ? { editing_by: me, editing_at: new Date().toISOString() } : { editing_by: null, editing_at: null })
    .eq('id', id);
}

/** Başka biri son 90 sn içinde düzenlemeye başladıysa onun id'si. */
export function editingOther(p: WikiPage, me: string): string | null {
  if (!p.editing_by || p.editing_by === me || !p.editing_at) return null;
  return Date.now() - new Date(p.editing_at).getTime() < 90_000 ? p.editing_by : null;
}

export const useRevisions = (pageId: string | null) =>
  useQuery(pageId ? `wikiRev:${pageId}` : null, async () => {
    const { data, error } = await supabase
      .from('wiki_revisions')
      .select('id, version, title, content, edited_by, created_at')
      .eq('page_id', pageId!)
      .order('version', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as WikiRevision[];
  });

export async function restoreRevision(pageId: string, revId: string) {
  const { error } = await supabase.rpc('restore_wiki_revision', { p_rev: revId });
  invalidate('wiki', `wikiRev:${pageId}`);
  if (error) throw error;
}

export async function uploadWikiImage(pageId: string, file: File) {
  // Dosyalar sayfasında görünsün diye özgün ad korunur (Türkçe karakter ve boşluk atılır).
  const safe = file.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .slice(-80) || 'gorsel.png';
  const path = `${pageId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from('wiki-files').upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

const urls = new Map<string, Promise<string>>();
/** Gizli kovadaki görsel için 1 saatlik imzalı adres (önbellekli). */
export function wikiImageUrl(path: string) {
  let u = urls.get(path);
  if (!u) {
    u = supabase.storage
      .from('wiki-files')
      .createSignedUrl(path, 3600)
      .then((r) => r.data?.signedUrl ?? '');
    urls.set(path, u);
    setTimeout(() => urls.delete(path), 50 * 60_000);
  }
  return u;
}

/** Kökten sayfaya kadar zincir (konum yolu için). */
export function ancestry(pages: WikiPage[], id: string): WikiPage[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const out: WikiPage[] = [];
  let cur = byId.get(id);
  while (cur && out.length < 20) {
    out.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return out;
}

export function isDescendant(pages: WikiPage[], id: string, of: string): boolean {
  return ancestry(pages, id).some((p) => p.id === of);
}
