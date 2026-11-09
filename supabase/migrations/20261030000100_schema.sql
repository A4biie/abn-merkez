-- ABN Merkez · şema
-- Durum ve tür alanları Türkçe anahtarlarla text + check olarak tutulur; ekranda gösterilen
-- etiketler uygulamada (prototype/*.html'deki metinlerle) eşlenir.

-- ───────────────────────── Profiller ─────────────────────────

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text not null default '',
  role_title         text not null default '',               -- Yazar, Programcı, Çizer...
  is_admin           boolean not null default false,
  avatar_url         text,
  avatar_color       text not null default '#C5B5FA',        -- fotoğraf yokken baş harf zemini
  banner_url         text,
  banner_color       text not null default 'lilac'
                       check (banner_color in ('lilac', 'lime', 'cyan', 'gece')),
  bio                text not null default '',
  links              jsonb not null default '[]'::jsonb      -- [{ "label": "ArtStation", "url": "..." }]
                       check (jsonb_typeof(links) = 'array'),
  availability       text not null default 'musait'
                       check (availability in ('musait', 'yogun', 'ara')),
  availability_until date,                                   -- "15 Ocak'a kadar molada"
  theme              text not null default 'dark'
                       check (theme in ('dark', 'light', 'indigo', 'gul', 'zeytin', 'adacayi',
                                        'tropik', 'gunbatimi', 'gece', 'pudra', 'noir')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Kâr payı oranı ayrı tabloda: prototipte "Kâr payı bilgisini sadece sen görüyorsun".
-- profiles herkese açık okunduğu için bu bilgi orada duramaz. Kişi kendi oranını, admin hepsini görür.
create table public.profit_shares (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  rate       numeric(5, 2) check (rate >= 0 and rate <= 100),   -- yüzde, boş = belirlenmedi
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Projeler ─────────────────────────

create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique,
  name       text not null check (length(trim(name)) > 0),
  summary    text not null default '',
  status     text not null default 'fikir'
               check (status in ('fikir', 'gelistirmede', 'test', 'beklemede', 'yayinda', 'rafta')),
  lead_id    uuid references public.profiles (id) on delete set null,
  progress   int not null default 0 check (progress between 0 and 100), -- kilometre taşlarından hesaplanır
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create table public.milestones (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title      text not null check (length(trim(title)) > 0),
  done       boolean not null default false,
  position   int not null default 0,
  due_date   date,
  created_at timestamptz not null default now()
);
create index milestones_project_idx on public.milestones (project_id, position);

-- ───────────────────────── Görevler ─────────────────────────

create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  title             text not null check (length(trim(title)) > 0),
  notes             text not null default '',
  project_id        uuid references public.projects (id) on delete set null,  -- boş = projesiz
  status            text not null default 'havuz'
                      check (status in ('havuz', 'bende', 'incelemede', 'bitti')),
  assignee_id       uuid references public.profiles (id) on delete set null,
  due_label         text not null default 'Acelesi yok',   -- "Bu hafta", "Bu ay", "20 Ekim"
  due_date          date,
  needs_help        boolean not null default false,        -- "Yardım istiyor"
  lock_type         text not null default 'yok' check (lock_type in ('yok', 'rol', 'kisi', 'admin')),
  lock_roles        text[] not null default '{}',
  lock_people       uuid[] not null default '{}',
  created_by        uuid references public.profiles (id) on delete set null,
  status_changed_at timestamptz not null default now(),    -- "bir süredir hareketsiz" için
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Havuzdaki görevin sahibi olmaz, havuz dışındakinin olur (bitti hariç: sahibi ayrılmış olabilir).
  check ((status = 'havuz') = (assignee_id is null) or status = 'bitti')
);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_status_idx on public.tasks (status);

-- ───────────────────────── İstekler ─────────────────────────

create table public.requests (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('proje', 'gorev')),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete cascade,
  task_id      uuid references public.tasks (id) on delete cascade,
  message      text not null default '',
  status       text not null default 'bekliyor' check (status in ('bekliyor', 'onaylandi', 'reddedildi')),
  decided_by   uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  check ((kind = 'proje' and project_id is not null and task_id is null)
      or (kind = 'gorev' and task_id is not null))
);
-- Aynı şey için aynı kişiden aynı anda tek bekleyen istek.
create unique index requests_pending_project_uniq on public.requests (requester_id, project_id)
  where status = 'bekliyor' and kind = 'proje';
create unique index requests_pending_task_uniq on public.requests (requester_id, task_id)
  where status = 'bekliyor' and kind = 'gorev';

-- ───────────────────────── Akış ─────────────────────────

create table public.posts (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references public.profiles (id) on delete cascade,
  type              text not null default 'paylasim' check (type in ('paylasim', 'fikrinizi_istiyorum')),
  body              text not null default '',
  project_id        uuid references public.projects (id) on delete set null,   -- etiket: "PaleMouth"
  task_id           uuid references public.tasks (id) on delete set null,      -- etiket: "· Ana karakter..."
  media             jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  pinned_comment_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id, created_at desc);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

alter table public.posts
  add constraint posts_pinned_comment_fk
  foreign key (pinned_comment_id) references public.comments (id) on delete set null;

-- ───────────────────────── Fikir Defteri ─────────────────────────

create table public.ideas (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  body       text not null check (length(trim(body)) > 0),
  status     text not null default 'yeni' check (status in ('yeni', 'konusuluyor', 'gorev', 'simdilik')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ideas_created_idx on public.ideas (created_at desc);

-- Kalpler: postlarda ve fikirlerde. Sayı gösterilmez, kim bıraktı küçük avatarlarla görünür.
create table public.hearts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid references public.posts (id) on delete cascade,
  idea_id    uuid references public.ideas (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(post_id, idea_id) = 1),
  unique (post_id, user_id),
  unique (idea_id, user_id)
);
create index hearts_post_idx on public.hearts (post_id);
create index hearts_idea_idx on public.hearts (idea_id);

-- ───────────────────────── Duyurular ve bildirimler ─────────────────────────

create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) > 0),
  body       text not null default '',
  pinned     boolean not null default false,
  author_id  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Akışın üstünde aynı anda tek sabit duyuru olur.
create unique index announcements_one_pinned on public.announcements (pinned) where pinned;

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,   -- alıcı
  actor_id   uuid references public.profiles (id) on delete set null,
  kind       text not null check (kind in ('yorum', 'kalp', 'istek_cevap', 'istek', 'duyuru',
                                           'gorev_atama', 'yardim', 'soru', 'diger')),
  text       text not null,                                -- "Rüzgar paylaşımına kalp bıraktı"
  link       text,                                         -- uygulama içi yol: "/akis/<id>"
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ───────────────────────── Panolar ─────────────────────────

create table public.boards (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(trim(title)) > 0),
  color           text not null default 'surface' check (color in ('surface', 'a1', 'a2', 'a3')),
  parent_board_id uuid references public.boards (id) on delete cascade,
  project_id      uuid references public.projects (id) on delete set null,   -- boş = genel pano
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (parent_board_id is distinct from id)
);
create index boards_parent_idx on public.boards (parent_board_id);
create index boards_project_idx on public.boards (project_id);

create table public.board_items (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards (id) on delete cascade,
  type       text not null check (type in ('heading', 'note', 'todo', 'image', 'color', 'link', 'board',
                                           'zone', 'sketch', 'table', 'quote', 'file', 'video')),
  x          real not null default 0,
  y          real not null default 0,
  w          real not null default 260,
  h          real,                                   -- boş = içeriğe göre (bölge ve çizimde dolu)
  color      text not null default 'surface' check (color in ('surface', 'a1', 'a2', 'a3')),
  z          int not null default 0,
  data       jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index board_items_board_idx on public.board_items (board_id);

create table public.board_links (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards (id) on delete cascade,
  from_item  uuid not null references public.board_items (id) on delete cascade,
  to_item    uuid not null references public.board_items (id) on delete cascade,
  start_cap  text not null default 'none' check (start_cap in ('none', 'dot', 'arrow')),
  end_cap    text not null default 'arrow' check (end_cap in ('none', 'dot', 'arrow')),
  dashed     boolean not null default false,
  bend_x     real not null default 0,
  bend_y     real not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_item <> to_item)
);
create index board_links_board_idx on public.board_links (board_id);

-- ───────────────────────── Yardımcı fonksiyonlar ─────────────────────────
-- security definer: RLS içinden çağrıldıklarında kendi tablolarının RLS'ine takılmasınlar.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_members
                 where project_id = p_project and user_id = auth.uid());
$$;

-- Projesiz panoyu herkes, projeli panoyu o projenin üyeleri ve adminler düzenler.
create or replace function public.can_edit_board(p_board uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.boards b
    where b.id = p_board
      and (b.project_id is null
           or public.is_admin()
           or public.is_project_member(b.project_id))
  );
$$;

-- Türkçe yönelme eki: Rüzgar'a, Ece'ye, Selin'e, Mert'e. Hata metinleri için.
create or replace function public.tr_dative(p_name text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_low  text := lower(trim(p_name));
  v_last text := right(v_low, 1);
  v_vow  text := (regexp_match(v_low, '([aıoueiöü])[^aıoueiöü]*$'))[1];
  v_suf  text;
begin
  if v_low = '' then return p_name; end if;
  v_suf := case when v_vow in ('a', 'ı', 'o', 'u') then 'a' else 'e' end;
  if v_last in ('a', 'ı', 'o', 'u', 'e', 'i', 'ö', 'ü') then
    v_suf := 'y' || v_suf;
  end if;
  return trim(p_name) || '’' || v_suf;
end;
$$;

-- ───────────────────────── Tetikleyiciler ─────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'projects', 'tasks', 'posts', 'comments', 'ideas',
                           'announcements', 'boards', 'board_items', 'board_links']
  loop
    execute format('create trigger %I before update on public.%I
                    for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- Yeni kayıtta profil ve boş kâr payı satırı açılır.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1), '')
  )
  on conflict (id) do nothing;
  insert into public.profit_shares (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kişi kendi profilinde admin bayrağını ve rol unvanını değiştiremez; bunlar admin işi.
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;   -- SQL editörü / servis anahtarı ya da admin
  end if;
  if new.is_admin is distinct from old.is_admin or new.role_title is distinct from old.role_title then
    raise exception 'Rolünü ve yönetici yetkisini sadece yöneticiler değiştirebilir.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Görev: admin olmayan kişi kilidi, projeyi ve oluşturanı değiştiremez.
-- Durum değişince "hareketsiz" sayacı sıfırlanır.
create or replace function public.guard_task_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;

  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.lock_type <> 'yok' or cardinality(new.lock_roles) > 0 or cardinality(new.lock_people) > 0 then
      raise exception 'Görev kilitlerini sadece yöneticiler ayarlayabilir.' using errcode = '42501';
    end if;
    new.created_by := auth.uid();
    return new;
  end if;

  if new.lock_type is distinct from old.lock_type
     or new.lock_roles is distinct from old.lock_roles
     or new.lock_people is distinct from old.lock_people then
    raise exception 'Görev kilitlerini sadece yöneticiler değiştirebilir.' using errcode = '42501';
  end if;
  if new.project_id is distinct from old.project_id or new.created_by is distinct from old.created_by then
    raise exception 'Görevin projesini sadece yöneticiler değiştirebilir.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger tasks_guard before insert or update on public.tasks
  for each row execute function public.guard_task_write();

-- Kilometre taşları değişince proje ilerlemesi yeniden hesaplanır.
create or replace function public.recalc_project_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects p
     set progress = coalesce((
           select round(100.0 * count(*) filter (where m.done) / nullif(count(*), 0))
             from public.milestones m where m.project_id = v_project), 0)
   where p.id = v_project;
  if tg_op = 'UPDATE' and old.project_id is distinct from new.project_id then
    update public.projects p
       set progress = coalesce((
             select round(100.0 * count(*) filter (where m.done) / nullif(count(*), 0))
               from public.milestones m where m.project_id = old.project_id), 0)
     where p.id = old.project_id;
  end if;
  return null;
end;
$$;

create trigger milestones_progress after insert or update or delete on public.milestones
  for each row execute function public.recalc_project_progress();

-- Proje lideri her zaman projenin üyesidir.
create or replace function public.ensure_lead_is_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.lead_id is not null then
    insert into public.project_members (project_id, user_id)
    values (new.id, new.lead_id) on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger projects_lead_member after insert or update of lead_id on public.projects
  for each row execute function public.ensure_lead_is_member();

-- Sabitlenen yorum o posta ait olmalı.
create or replace function public.check_pinned_comment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.pinned_comment_id is not null and not exists (
       select 1 from public.comments c where c.id = new.pinned_comment_id and c.post_id = new.id) then
    raise exception 'Sadece bu paylaşımın altındaki bir yorumu sabitleyebilirsin.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger posts_pinned_check before insert or update of pinned_comment_id on public.posts
  for each row execute function public.check_pinned_comment();

-- Yeni duyuru sabitlenince öncekinin sabitlemesi kalkar (prototipteki davranış).
create or replace function public.unpin_other_announcements()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.pinned then
    update public.announcements set pinned = false where pinned and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger announcements_single_pin before insert or update of pinned on public.announcements
  for each row execute function public.unpin_other_announcements();

-- Alt pano, proje bilgisini üst panodan alır.
create or replace function public.inherit_board_project()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.parent_board_id is not null and new.project_id is null then
    select project_id into new.project_id from public.boards where id = new.parent_board_id;
  end if;
  return new;
end;
$$;

create trigger boards_inherit_project before insert on public.boards
  for each row execute function public.inherit_board_project();

-- Bağlantının iki ucu da aynı panoda olmalı.
create or replace function public.check_link_same_board()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.board_items i
             where i.id in (new.from_item, new.to_item) and i.board_id <> new.board_id) then
    raise exception 'Bağlantı sadece aynı panodaki kartlar arasında kurulabilir.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger board_links_same_board before insert or update on public.board_links
  for each row execute function public.check_link_same_board();

-- İstek onaylanınca: katılım isteği kişiyi projeye ekler, görev isteği görevi ona verir.
create or replace function public.apply_request_decision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = old.status then
    return new;
  end if;
  new.decided_at := now();
  new.decided_by := coalesce(auth.uid(), new.decided_by);

  if new.status = 'onaylandi' then
    if new.kind = 'proje' then
      insert into public.project_members (project_id, user_id)
      values (new.project_id, new.requester_id) on conflict do nothing;
    else
      update public.tasks
         set assignee_id = new.requester_id, status = 'bende'
       where id = new.task_id and status = 'havuz';
    end if;
  end if;
  return new;
end;
$$;

create trigger requests_apply_decision before update of status on public.requests
  for each row execute function public.apply_request_decision();
