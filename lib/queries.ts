// Bütün veri okuma ve yazma işleri burada. Ekranlar Supabase'e doğrudan değil, bu dosya
// üzerinden konuşur. Ekip küçük olduğu için listeler sayfalama olmadan tek seferde çekilir.

import { Platform } from 'react-native';

import { uuid } from './board';
import { enqueue, isOffline } from './connection';
import { supabase } from './supabase';
import type {
  Announcement,
  AppNotification,
  Availability,
  ClaimResult,
  Idea,
  Post,
  PostType,
  Profile,
  Project,
  RequestKind,
  Task,
  TaskStatus,
  TeamRequest,
} from './types';
import { invalidate, mutateCache, useQuery } from './useQuery';

function must<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

// ───────────────────────── Okuma ─────────────────────────

export async function fetchProfiles() {
  return must<Profile[]>(await supabase.from('profiles').select('*').order('created_at'));
}

export async function fetchProjects() {
  const rows = must<(Omit<Project, 'members' | 'milestones'> & {
    project_members: { user_id: string }[];
    milestones: Project['milestones'];
  })[]>(
    await supabase
      .from('projects')
      .select('*, project_members(user_id), milestones(*)')
      .order('created_at')
      .order('position', { referencedTable: 'milestones' }),
  );
  return rows.map(({ project_members, milestones, ...p }) => ({
    ...p,
    members: project_members.map((m) => m.user_id),
    milestones,
  })) as Project[];
}

export async function fetchTasks() {
  return must<Task[]>(await supabase.from('tasks').select('*').order('position').order('created_at', { ascending: false }));
}

export async function fetchRequests() {
  return must<TeamRequest[]>(
    await supabase.from('requests').select('*').order('created_at', { ascending: false }),
  );
}

export async function fetchFeed() {
  return must<Post[]>(
    await supabase
      .from('posts')
      .select('*, comments!comments_post_id_fkey(*), hearts(user_id, created_at), polls(*), poll_options(*)')
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'comments' })
      .order('created_at', { referencedTable: 'hearts', ascending: false })
      .order('position', { referencedTable: 'poll_options' })
      .limit(60),
  );
}

export async function fetchPinnedAnnouncement() {
  return must<Announcement | null>(
    await supabase.from('announcements').select('*').eq('pinned', true).maybeSingle(),
  );
}

export async function fetchIdeas() {
  return must<Idea[]>(
    await supabase
      .from('ideas')
      .select('*, hearts(user_id, created_at)')
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'hearts', ascending: false })
      .order('position', { referencedTable: 'poll_options' }),
  );
}

export async function fetchNotifications() {
  return must<AppNotification[]>(
    await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
  );
}

/** Kâr payı: kişi sadece kendininkini, admin herkesinkini görür (RLS). */
export async function fetchProfitShares() {
  const rows = must<{ user_id: string; rate: number | null }[]>(
    await supabase.from('profit_shares').select('user_id, rate'),
  );
  return Object.fromEntries(rows.map((r) => [r.user_id, r.rate]));
}

/** Projenin ana panosu (Aşama 5'te pano ekranı bu kimlikle açılır). */
export async function fetchProjectBoardId(projectId: string) {
  const row = must<{ id: string } | null>(
    await supabase
      .from('boards')
      .select('id')
      .eq('project_id', projectId)
      .is('parent_board_id', null)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  );
  return row?.id ?? null;
}

// ───────────────────────── Hook'lar ─────────────────────────

export const useProfiles = () => useQuery('profiles', fetchProfiles);
export const useProjects = () => useQuery('projects', fetchProjects);
export const useTasks = () => useQuery('tasks', fetchTasks);
export const useRequests = () => useQuery('requests', fetchRequests);
export const useFeed = () => useQuery('feed', fetchFeed);
export const usePinnedAnnouncement = () => useQuery('announcement', fetchPinnedAnnouncement);
export const useIdeas = () => useQuery('ideas', fetchIdeas);
export const useNotifications = () => useQuery('notifications', fetchNotifications);
export const useProfitShares = () => useQuery('profitShares', fetchProfitShares);

// ───────────────────────── Akış ─────────────────────────

export async function setAvailability(userId: string, availability: Availability) {
  const patch = { availability, availability_until: null };
  mutateCache<Profile[]>('profiles', (prev) => prev?.map((p) => (p.id === userId ? { ...p, ...patch } : p)) ?? []);
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) invalidate('profiles');
  return error;
}

/** Kalp bırak ya da geri al. Önce ekranda değişir, sonra kaydedilir. */
export async function toggleHeart(kind: 'post' | 'idea', id: string, userId: string, liked: boolean) {
  const key = kind === 'post' ? 'feed' : 'ideas';
  const column = kind === 'post' ? 'post_id' : 'idea_id';
  mutateCache<(Post | Idea)[]>(key, (prev) =>
    (prev ?? []).map((x) =>
      x.id !== id
        ? x
        : {
            ...x,
            hearts: liked
              ? x.hearts.filter((h) => h.user_id !== userId)
              : [{ user_id: userId }, ...x.hearts],
          },
    ),
  );
  const { error } = liked
    ? await supabase.from('hearts').delete().eq(column, id).eq('user_id', userId)
    : await supabase.from('hearts').insert({ [column]: id, user_id: userId });
  if (error) invalidate(key);
  return error;
}

export async function addComment(postId: string, userId: string, body: string) {
  const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: userId, body });
  invalidate('feed');
  return error;
}

export async function setPinnedComment(postId: string, commentId: string | null) {
  mutateCache<Post[]>('feed', (prev) =>
    (prev ?? []).map((p) => (p.id === postId ? { ...p, pinned_comment_id: commentId } : p)),
  );
  const { error } = await supabase.from('posts').update({ pinned_comment_id: commentId }).eq('id', postId);
  if (error) invalidate('feed');
  return error;
}

export async function addPost(input: {
  userId: string;
  body: string;
  type: PostType;
  projectId: string | null;
  taskId?: string | null;
}) {
  const row = {
    id: uuid(),
    author_id: input.userId,
    body: input.body,
    type: input.type,
    project_id: input.projectId,
    task_id: input.taskId ?? null,
  };
  // Bağlantı yoksa paylaşım akışta "Bekliyor" olarak görünür, bağlantı gelince gönderilir.
  if (isOffline()) {
    const draft: Post = {
      ...row,
      media: [],
      pinned_comment_id: null,
      created_at: new Date().toISOString(),
      comments: [],
      hearts: [],
      pending: true,
    };
    mutateCache<Post[]>('feed', (prev) => [draft, ...(prev ?? [])]);
    enqueue(row.id, async () => {
      const { error } = await supabase.from('posts').insert(row);
      if (error) throw error;
      mutateCache<Post[]>('feed', (prev) =>
        (prev ?? []).map((p) => (p.id === row.id ? { ...p, pending: false, sentFromQueue: true } : p)),
      );
      setTimeout(() => invalidate('feed'), 2000);
    });
    return null;
  }
  const { error } = await supabase.from('posts').insert(row);
  invalidate('feed');
  return error;
}

// ───────────────────────── Görevler ─────────────────────────

export async function claimTask(taskId: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('claim_task', { p_task_id: taskId });
  if (error) throw error;
  invalidate('tasks');
  return data as ClaimResult;
}

async function updateTask(taskId: string, patch: Partial<Task>) {
  mutateCache<Task[]>('tasks', (prev) => (prev ?? []).map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  const { error } = await supabase.from('tasks').update(patch).eq('id', taskId);
  invalidate('tasks');
  return error;
}

/** Kanban'da sürükle bırak: sütun (durum) ve sütun içi sıra. Havuza geri bırakılan görev sahipsiz kalır. */
export function moveTask(task: Task, status: TaskStatus, position: number) {
  const patch: Partial<Task> = { status, position };
  if (status === 'havuz') Object.assign(patch, { assignee_id: null, needs_help: false });
  if (status === 'bitti') patch.needs_help = false;
  return updateTask(task.id, patch);
}

export function advanceTask(task: Task) {
  const next: TaskStatus = task.status === 'bende' ? 'incelemede' : 'bitti';
  return updateTask(task.id, { status: next, needs_help: next === 'bitti' ? false : task.needs_help });
}

export function setNeedsHelp(taskId: string, needsHelp: boolean) {
  return updateTask(taskId, { needs_help: needsHelp });
}

/** "Hâlâ sende mi?" hatırlatmasının cevapları. */
export function answerNudge(task: Task, answer: 'keep' | 'time' | 'drop') {
  const now = new Date().toISOString();
  if (answer === 'drop') return updateTask(task.id, { assignee_id: null, status: 'havuz', needs_help: false });
  if (answer === 'time') return updateTask(task.id, { due_label: 'Acelesi yok', status_changed_at: now });
  return updateTask(task.id, { status_changed_at: now });
}

export async function addTask(input: { title: string; projectId: string | null; mine: boolean; userId: string; status?: TaskStatus }) {
  const status: TaskStatus = input.status && input.status !== 'havuz' ? input.status : input.mine ? 'bende' : 'havuz';
  const { error } = await supabase.from('tasks').insert({
    title: input.title,
    project_id: input.projectId,
    status,
    assignee_id: status !== 'havuz' ? input.userId : null,
    created_by: input.userId,
  });
  invalidate('tasks');
  return error;
}

export async function sendRequest(input: {
  userId: string;
  kind: RequestKind;
  projectId?: string | null;
  taskId?: string | null;
}) {
  const { error } = await supabase.from('requests').insert({
    requester_id: input.userId,
    kind: input.kind,
    project_id: input.kind === 'proje' ? input.projectId : null,
    task_id: input.kind === 'gorev' ? input.taskId : null,
  });
  invalidate('requests');
  // Aynı istek zaten bekliyorsa (benzersiz dizin) bunu hata saymayız.
  return error?.code === '23505' ? null : error;
}

/** Admin kararı. Onaylanan isteğin sonucunu (üyelik ya da görev) veritabanı kendisi işler. */
export async function decideRequest(requestId: string, approve: boolean) {
  const { error } = await supabase
    .from('requests')
    .update({ status: approve ? 'onaylandi' : 'reddedildi' })
    .eq('id', requestId);
  invalidate('requests', 'projects', 'tasks');
  return error;
}

// ───────────────────────── Fikir Defteri ─────────────────────────

export async function addIdea(userId: string, body: string, projectId: string | null = null) {
  const { error } = await supabase.from('ideas').insert({ author_id: userId, body, project_id: projectId });
  invalidate('ideas');
  return error;
}

export async function setIdeaStatus(ideaId: string, status: Idea['status']) {
  mutateCache<Idea[]>('ideas', (prev) => (prev ?? []).map((i) => (i.id === ideaId ? { ...i, status } : i)));
  const { error } = await supabase.from('ideas').update({ status }).eq('id', ideaId);
  invalidate('ideas');
  return error;
}

/** Fikirden havuza görev açar (prototipteki convertIdea: 48 karakterden uzunsa kısaltır). */
export async function convertIdea(idea: Idea, userId: string) {
  const title = idea.body.length > 48 ? idea.body.slice(0, 46) + '…' : idea.body;
  const { error } = await supabase
    .from('tasks')
    .insert({ title, notes: idea.body, project_id: idea.project_id, status: 'havuz', created_by: userId });
  if (error) return error;
  invalidate('tasks');
  return setIdeaStatus(idea.id, 'gorev');
}

// ───────────────────────── Bildirimler ─────────────────────────

export async function markAllNotificationsRead(userId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: now })
    .eq('user_id', userId)
    .is('read_at', null);
  invalidate('notifications', 'unread');
  return error;
}

// ───────────────────────── Profil ─────────────────────────

export type PickedImage = { uri: string; base64?: string | null; mimeType?: string | null; file?: File | null };

function decodeBase64(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Seçilen görseli avatars/ ya da banners/ kovasına "<kişi>/<zaman>.<uzantı>" olarak yükler. */
/** Seçilen görselin yüklenecek içeriği, türü ve uzantısı. */
export async function pickedImageBody(image: PickedImage) {
  const type = image.mimeType ?? image.file?.type ?? 'image/jpeg';
  const ext = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  let body: Blob | Uint8Array;
  if (Platform.OS === 'web') {
    body = image.file ?? (await (await fetch(image.uri)).blob());
  } else if (image.base64) {
    body = decodeBase64(image.base64);
  } else {
    throw new Error('Görsel okunamadı.');
  }
  return { body, type, ext };
}

export async function uploadProfileImage(bucket: 'avatars' | 'banners', userId: string, image: PickedImage) {
  const { body, type, ext } = await pickedImageBody(image);
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: type, upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// ───────────────────────── Yönetim paneli (sadece yöneticiler; RLS ayrıca korur) ─────────────────────────

export async function fetchAnnouncements() {
  return must<Announcement[]>(
    await supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }),
  );
}
export const useAnnouncements = () => useQuery('announcements', fetchAnnouncements);

export async function adminUpdateProfile(userId: string, patch: Partial<Pick<Profile, 'role_title' | 'is_admin'>>) {
  mutateCache<Profile[]>('profiles', (prev) => (prev ?? []).map((p) => (p.id === userId ? { ...p, ...patch } : p)));
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  invalidate('profiles');
  return error;
}

export async function setProfitShare(userId: string, rate: number | null) {
  mutateCache<Record<string, number | null>>('profitShares', (prev) => ({ ...(prev ?? {}), [userId]: rate }));
  const { error } = await supabase.from('profit_shares').upsert({ user_id: userId, rate, updated_at: new Date().toISOString() });
  if (error) invalidate('profitShares');
  return error;
}

export async function updateProject(projectId: string, patch: Partial<Pick<Project, 'status' | 'lead_id' | 'name' | 'summary'>>) {
  mutateCache<Project[]>('projects', (prev) => (prev ?? []).map((p) => (p.id === projectId ? { ...p, ...patch } : p)));
  const { error } = await supabase.from('projects').update(patch).eq('id', projectId);
  invalidate('projects');
  return error;
}

/** Yeni proje açar; proje yöneticisi ekibe de eklenir. */
export async function createProject(name: string, summary: string, leadId: string) {
  const id = uuid();
  const { error } = await supabase.from('projects').insert({ id, name, summary, lead_id: leadId });
  if (error) return error;
  const { error: memberError } = await supabase.from('project_members').insert({ project_id: id, user_id: leadId });
  invalidate('projects');
  return memberError;
}

export async function setProjectMember(projectId: string, userId: string, member: boolean) {
  mutateCache<Project[]>('projects', (prev) =>
    (prev ?? []).map((p) =>
      p.id !== projectId ? p : { ...p, members: member ? [...p.members, userId] : p.members.filter((m) => m !== userId) },
    ),
  );
  const { error } = member
    ? await supabase.from('project_members').insert({ project_id: projectId, user_id: userId })
    : await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
  invalidate('projects');
  return error;
}

export async function addMilestone(projectId: string, title: string, position: number) {
  const { error } = await supabase.from('milestones').insert({ project_id: projectId, title, position });
  invalidate('projects');
  return error;
}

export async function setMilestoneDone(milestoneId: string, done: boolean) {
  mutateCache<Project[]>('projects', (prev) =>
    (prev ?? []).map((p) => ({ ...p, milestones: p.milestones.map((m) => (m.id === milestoneId ? { ...m, done } : m)) })),
  );
  const { error } = await supabase.from('milestones').update({ done }).eq('id', milestoneId);
  invalidate('projects');
  return error;
}

export async function setTaskLock(taskId: string, patch: Partial<Pick<Task, 'lock_type' | 'lock_roles' | 'lock_people'>>) {
  mutateCache<Task[]>('tasks', (prev) => (prev ?? []).map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  const { error } = await supabase.from('tasks').update(patch).eq('id', taskId);
  invalidate('tasks');
  return error;
}

export async function createAnnouncement(title: string, body: string, pinned: boolean) {
  const { error } = await supabase.from('announcements').insert({ title, body, pinned });
  invalidate('announcements', 'announcement');
  return error;
}

export async function setAnnouncementPinned(id: string, pinned: boolean) {
  const { error } = await supabase.from('announcements').update({ pinned }).eq('id', id);
  invalidate('announcements', 'announcement');
  return error;
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  invalidate('announcements', 'announcement');
  return error;
}

/** "Nazikçe sor": hareketsiz görevin sahibine sadece onun göreceği bir soru gider. */
export async function askStillYours(taskId: string) {
  const { error } = await supabase.rpc('ask_still_yours', { p_task_id: taskId });
  return error;
}

/** Yeni ekip üyesi açar; kişi bu kullanıcı adı ve şifreyle girer. */
export async function adminCreateMember(username: string, fullName: string, password: string) {
  const { error } = await supabase.rpc('admin_create_member', {
    p_username: username,
    p_full_name: fullName,
    p_password: password,
  });
  if (!error) invalidate('profiles');
  return error;
}

/** Kullanıcı adını ve/veya şifreyi değiştirir; değişmeyecek olan null kalır. */
export async function adminSetLogin(userId: string, username: string | null, password: string | null) {
  const { error } = await supabase.rpc('admin_set_login', {
    p_user: userId,
    p_username: username,
    p_password: password,
  });
  if (!error && username) invalidate('profiles');
  return error;
}
