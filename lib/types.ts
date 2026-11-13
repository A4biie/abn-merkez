// supabase/migrations içindeki tabloların istemci tarafı tipleri.
// Şema değişirse burası da güncellenir.

import type { ThemeName } from '@/theme/themes';

export type Availability = 'musait' | 'yogun' | 'ara';
export type BannerColor = 'lilac' | 'lime' | 'cyan' | 'gece';

export type PresenceStatus = 'online' | 'busy' | 'idle' | 'invisible';

export type ProfileLink = { label: string; url: string };

export type Profile = {
  id: string;
  /** Girişte kullanılan ad (küçük harf). Sadece yönetici değiştirir. */
  username: string;
  full_name: string;
  role_title: string;
  is_admin: boolean;
  avatar_url: string | null;
  avatar_color: string;
  banner_url: string | null;
  banner_color: BannerColor;
  bio: string;
  links: ProfileLink[];
  availability: Availability;
  availability_until: string | null;
  /** null: sistem moduna göre (koyu → Gece Yarısı, açık → Nane). */
  theme: ThemeName | null;
  /** Hoş geldin turu bitti ya da atlandı. */
  onboarded: boolean;
  /** "Ne yaparsın?" seçimleri (Yazar, Çizer...). */
  skills: string[];
  /** Sessiz saatler (0-23). İkisi de boşsa kapalı. */
  quiet_start: number | null;
  quiet_end: number | null;
  time_zone: string;
  /** Anlık durum (0.10.0). Görünmez, başkalarına çevrimdışı görünür. */
  status?: PresenceStatus;
  custom_status?: string;
  custom_status_emoji?: string;
  custom_status_expires_at?: string | null;
  pronouns?: string;
  /** Profil vurgu rengi (#RRGGBB); boşsa temanın a1'i. */
  accent_color?: string | null;
  work_hours?: string;
  created_at: string;
  updated_at: string;
};

export type ProjectStatus = 'fikir' | 'gelistirmede' | 'test' | 'beklemede' | 'yayinda' | 'rafta';

export type Milestone = {
  id: string;
  project_id: string;
  title: string;
  done: boolean;
  position: number;
  due_date: string | null;
};

export type Project = {
  id: string;
  slug: string | null;
  name: string;
  summary: string;
  status: ProjectStatus;
  lead_id: string | null;
  progress: number;
  created_at: string;
  members: string[];
  milestones: Milestone[];
};

export type TaskStatus = 'havuz' | 'bende' | 'incelemede' | 'bitti';
export type LockType = 'yok' | 'rol' | 'kisi' | 'admin';

export type Task = {
  id: string;
  title: string;
  notes: string;
  project_id: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  due_label: string;
  due_date: string | null;
  needs_help: boolean;
  lock_type: LockType;
  lock_roles: string[];
  lock_people: string[];
  created_by: string | null;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
  /** Kanban sütun içi sıra (küçük üstte). */
  position: number;
};

export type RequestKind = 'proje' | 'gorev';
export type RequestStatus = 'bekliyor' | 'onaylandi' | 'reddedildi';

export type TeamRequest = {
  id: string;
  kind: RequestKind;
  requester_id: string;
  project_id: string | null;
  task_id: string | null;
  message: string;
  status: RequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type PostType = 'paylasim' | 'fikrinizi_istiyorum' | 'oylama';

/** Oylama ayarları (polls). Oylar ve sonuçlar poll_results() ile okunur. */
export type Poll = {
  post_id: string;
  multiple: boolean;
  anonymous: boolean;
  ends_at: string | null;
  show_results: 'oy_verince' | 'bitince';
  closed_at: string | null;
};

export type PollOption = {
  id: string;
  post_id: string;
  body: string;
  image_path: string | null;
  position: number;
};

/** Prototipteki çizim yer tutucuları ("ornek") ya da yüklenmiş görsel. */
export type PostMedia = { type: 'ornek'; art: 'face' | 'video' | 'mood' } | { type: 'image'; url: string };

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  type: PostType;
  body: string;
  project_id: string | null;
  task_id: string | null;
  media: PostMedia[];
  pinned_comment_id: string | null;
  created_at: string;
  comments: Comment[];
  hearts: { user_id: string }[];
  /** Sadece oylama postlarında dolu. */
  polls?: Poll | null;
  poll_options?: PollOption[];
  /** Bağlantı yokken yazıldı, gönderilmeyi bekliyor (sadece istemcide). */
  pending?: boolean;
  sentFromQueue?: boolean;
};

export type IdeaStatus = 'yeni' | 'konusuluyor' | 'gorev' | 'simdilik';

export type Idea = {
  id: string;
  author_id: string;
  project_id: string | null;
  body: string;
  status: IdeaStatus;
  created_at: string;
  hearts: { user_id: string }[];
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  author_id: string | null;
  created_at: string;
};

export type NotificationKind =
  'yorum' | 'kalp' | 'istek_cevap' | 'istek' | 'duyuru' | 'gorev_atama' | 'yardim' | 'soru' | 'diger';

export type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: NotificationKind;
  text: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/** claim_task() dönüşü (supabase/migrations/..._rls.sql). */
export type ClaimResult =
  | { ok: true; message: string; task_id?: string }
  | {
      ok: false;
      code: 'yok' | 'alinmis' | 'proje_disi' | 'kilit_rol' | 'kilit_kisi' | 'kilit_admin';
      title: string;
      reason: string;
      task_id?: string;
      project_id?: string | null;
      request_kind?: RequestKind;
      request_pending?: boolean;
    };
