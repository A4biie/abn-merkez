-- ABN Merkez · sohbet
--
-- Oda türleri: 'genel' (herkes), 'proje' (proje açılınca otomatik; proje üyeleri), 'ozel' (iki kişi).
-- Üyelikleri tetikleyiciler yönetir; istemci odaya ya da üyeliğe doğrudan yazamaz.
-- Zorlamama ilkesi: "görüldü" ve "yazıyor..." yok. Okundu bilgisi (chat_reads) sadece kişinin
-- kendisine görünür; okunmamış noktası için kullanılır, başkasına "gördü" diye yansımaz.

-- ───────────────────────── Bildirim türleri ve sessiz saatler ─────────────────────────

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('yorum', 'kalp', 'istek_cevap', 'istek', 'duyuru', 'gorev_atama', 'yardim', 'soru',
                  'anma', 'oylama', 'diger'));

-- Sessiz saatler: bu saatler arasında sohbet bildirimleri telefona gitmez, uygulama içinde birikir.
-- Örn. 23 → 8 gece yarısını aşar. İkisi de boşsa kapalı.
alter table public.profiles
  add column quiet_start smallint check (quiet_start between 0 and 23),
  add column quiet_end   smallint check (quiet_end between 0 and 23),
  add column time_zone   text not null default 'Europe/Istanbul';

-- ───────────────────────── Tablolar ─────────────────────────

create table public.chat_rooms (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('genel', 'proje', 'ozel')),
  project_id      uuid unique references public.projects (id) on delete cascade,
  direct_key      text unique,                       -- özel odada "küçük-id:büyük-id"
  title           text not null default '',
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  check ((kind = 'proje') = (project_id is not null)),
  check ((kind = 'ozel') = (direct_key is not null))
);
create unique index chat_rooms_tek_genel on public.chat_rooms ((true)) where kind = 'genel';

create table public.chat_members (
  room_id   uuid not null references public.chat_rooms (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index chat_members_user on public.chat_members (user_id);

-- Kişinin bir odayı en son ne zaman açtığı. Sadece kendisi görür.
create table public.chat_reads (
  room_id      uuid not null references public.chat_rooms (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.chat_rooms (id) on delete cascade,
  author_id       uuid references public.profiles (id) on delete set null,
  body            text not null default '',
  attachment_path text,                               -- chat-files kovasında "<oda id>/<dosya>"
  attachment_kind text check (attachment_kind in ('gorsel', 'ses')),
  attachment_ms   int,                                -- ses kaydının süresi
  reply_to        uuid references public.messages (id) on delete set null,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  check ((attachment_path is null) = (attachment_kind is null)),
  check (deleted_at is not null or length(trim(body)) > 0 or attachment_path is not null)
);
create index messages_room_time on public.messages (room_id, created_at desc);

create table public.message_hearts (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- ───────────────────────── Yardımcılar ─────────────────────────

create or replace function public.is_chat_member(p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_members where room_id = p_room and user_id = auth.uid());
$$;

create or replace function public.genel_room()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  select id into v from public.chat_rooms where kind = 'genel';
  if v is null then
    insert into public.chat_rooms (kind, title) values ('genel', 'Genel') returning id into v;
  end if;
  return v;
end;
$$;

-- ───────────────────────── Üyelik tetikleyicileri ─────────────────────────

-- Yeni kişi genel odaya girer.
create or replace function public.chat_join_genel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_members (room_id, user_id) values (public.genel_room(), new.id)
  on conflict do nothing;
  return new;
end;
$$;
create trigger profiles_chat_genel after insert on public.profiles
  for each row execute function public.chat_join_genel();

-- Proje açılınca odası açılır; adı değişince oda adı da değişir.
create or replace function public.chat_project_room()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.chat_rooms (kind, project_id, title) values ('proje', new.id, new.name)
    on conflict (project_id) do nothing;
  elsif new.name is distinct from old.name then
    update public.chat_rooms set title = new.name where project_id = new.id;
  end if;
  return new;
end;
$$;
create trigger projects_chat_room after insert or update of name on public.projects
  for each row execute function public.chat_project_room();

-- Proje üyeliği değişince oda üyeliği de değişir.
create or replace function public.chat_project_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_room uuid;
begin
  if tg_op = 'INSERT' then
    select id into v_room from public.chat_rooms where project_id = new.project_id;
    if v_room is not null then
      insert into public.chat_members (room_id, user_id) values (v_room, new.user_id) on conflict do nothing;
    end if;
    return new;
  end if;
  delete from public.chat_members m using public.chat_rooms r
   where r.id = m.room_id and r.project_id = old.project_id and m.user_id = old.user_id;
  return old;
end;
$$;
create trigger project_members_chat after insert or delete on public.project_members
  for each row execute function public.chat_project_member();

-- Var olan kişi ve projeler.
select public.genel_room();
insert into public.chat_members (room_id, user_id)
  select public.genel_room(), id from public.profiles on conflict do nothing;
insert into public.chat_rooms (kind, project_id, title)
  select 'proje', id, name from public.projects on conflict (project_id) do nothing;
insert into public.chat_members (room_id, user_id)
  select r.id, pm.user_id from public.project_members pm join public.chat_rooms r on r.project_id = pm.project_id
  on conflict do nothing;

-- İki kişilik özel odayı bulur ya da açar. Dönüş: oda id.
create or replace function public.open_direct_room(p_other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me  uuid := auth.uid();
  v_key text;
  v_id  uuid;
begin
  if v_me is null then raise exception 'Önce giriş yapmalısın.' using errcode = '42501'; end if;
  if p_other is null or p_other = v_me then
    raise exception 'Kendine mesaj odası açamazsın.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'Kişi bulunamadı.' using errcode = 'P0002';
  end if;
  v_key := least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text);
  select id into v_id from public.chat_rooms where direct_key = v_key;
  if v_id is null then
    insert into public.chat_rooms (kind, direct_key) values ('ozel', v_key) returning id into v_id;
    insert into public.chat_members (room_id, user_id) values (v_id, v_me), (v_id, p_other);
  end if;
  return v_id;
end;
$$;

-- ───────────────────────── Mesaj tetikleyicileri ─────────────────────────

-- Yazar sadece metni değiştirebilir (düzenlendi işareti konur). Silme delete_message ile yapılır.
create or replace function public.guard_message_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('abn.message_delete', true) = 'on' then
    return new;
  end if;
  if old.deleted_at is not null then
    raise exception 'Silinmiş mesaj düzenlenemez.' using errcode = '42501';
  end if;
  if new.room_id is distinct from old.room_id or new.author_id is distinct from old.author_id
     or new.attachment_path is distinct from old.attachment_path or new.reply_to is distinct from old.reply_to
     or new.created_at is distinct from old.created_at or new.deleted_at is distinct from old.deleted_at then
    raise exception 'Mesajda sadece metin düzenlenebilir.' using errcode = '42501';
  end if;
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
create trigger messages_guard before update on public.messages
  for each row execute function public.guard_message_update();

-- Kendi mesajını ya da (yönetici) herhangi bir mesajı siler. İçerik temizlenir, yanıt zinciri bozulmasın
-- diye satır "silindi" olarak kalır.
create or replace function public.delete_message(p_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.messages;
begin
  select * into v from public.messages where id = p_message;
  if v.id is null or not public.is_chat_member(v.room_id) then
    raise exception 'Mesaj bulunamadı.' using errcode = 'P0002';
  end if;
  if v.author_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Başkasının mesajını sadece yöneticiler silebilir.' using errcode = '42501';
  end if;
  perform set_config('abn.message_delete', 'on', true);
  update public.messages
     set body = '', attachment_path = null, attachment_kind = null, attachment_ms = null,
         deleted_at = now(), deleted_by = auth.uid()
   where id = p_message;
  perform set_config('abn.message_delete', 'off', true);
  delete from public.message_hearts where message_id = p_message;
end;
$$;

-- Yeni mesaj: odanın son mesaj zamanı ve "@kullanıcıadı" anmaları.
create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_room public.chat_rooms;
  v_where text;
begin
  update public.chat_rooms set last_message_at = new.created_at where id = new.room_id;
  if new.body = '' then return new; end if;

  select * into v_room from public.chat_rooms where id = new.room_id;
  v_where := case v_room.kind when 'genel' then 'genel sohbette'
                              when 'proje' then v_room.title || ' sohbetinde'
                              else 'özel mesajda' end;
  for r in
    select distinct p.id from public.profiles p
      join public.chat_members m on m.user_id = p.id and m.room_id = new.room_id
     where p.username in (select lower(x[1]) from regexp_matches(new.body, '@([A-Za-z0-9._-]{3,32})', 'g') as x)
  loop
    perform public.notify(r.id, new.author_id, 'anma',
      public.person_name(new.author_id) || ' seni ' || v_where || ' andı', '/sohbet/' || new.room_id);
  end loop;
  return new;
end;
$$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- Oda listesi: son mesaj ve okunmamış noktası. Sadece kişinin üyesi olduğu odalar.
create or replace function public.chat_overview()
returns table (
  room_id uuid, kind text, project_id uuid, title text, other_user uuid,
  last_message_at timestamptz, last_body text, last_author uuid, last_attachment text, last_deleted boolean,
  unread boolean
) language sql stable security definer set search_path = '' as $$
  select r.id, r.kind, r.project_id, r.title,
         (select m2.user_id from public.chat_members m2 where m2.room_id = r.id and m2.user_id <> auth.uid() and r.kind = 'ozel' limit 1),
         r.last_message_at, lm.body, lm.author_id, lm.attachment_kind, lm.deleted_at is not null,
         exists (
           select 1 from public.messages x
            where x.room_id = r.id and x.deleted_at is null and x.author_id is distinct from auth.uid()
              and x.created_at > coalesce(cr.last_read_at, m.joined_at)
         )
    from public.chat_members m
    join public.chat_rooms r on r.id = m.room_id
    left join public.chat_reads cr on cr.room_id = r.id and cr.user_id = auth.uid()
    left join lateral (
      select body, author_id, attachment_kind, deleted_at from public.messages
       where room_id = r.id order by created_at desc limit 1
    ) lm on true
   where m.user_id = auth.uid()
   order by (r.kind = 'genel') desc, r.last_message_at desc nulls last, r.created_at;
$$;

-- ───────────────────────── RLS ─────────────────────────

alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_reads enable row level security;
alter table public.messages enable row level security;
alter table public.message_hearts enable row level security;

create policy "odalar: üyeler görür" on public.chat_rooms
  for select to authenticated using (public.is_chat_member(id));

create policy "oda üyeleri: aynı odadakiler görür" on public.chat_members
  for select to authenticated using (public.is_chat_member(room_id));

create policy "okundu: kişi kendininkini görür" on public.chat_reads
  for select to authenticated using (user_id = auth.uid());
create policy "okundu: kişi kendininkini yazar" on public.chat_reads
  for insert to authenticated with check (user_id = auth.uid() and public.is_chat_member(room_id));
create policy "okundu: kişi kendininkini günceller" on public.chat_reads
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "mesajlar: oda üyeleri görür" on public.messages
  for select to authenticated using (public.is_chat_member(room_id));
create policy "mesajlar: üye kendi adına yazar" on public.messages
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_chat_member(room_id)
              and deleted_at is null and edited_at is null);
create policy "mesajlar: yazar kendininkini düzenler" on public.messages
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "mesaj kalpleri: oda üyeleri görür" on public.message_hearts
  for select to authenticated
  using (exists (select 1 from public.messages x where x.id = message_id and public.is_chat_member(x.room_id)));
create policy "mesaj kalpleri: üye kendi kalbini bırakır" on public.message_hearts
  for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.messages x where x.id = message_id and x.deleted_at is null and public.is_chat_member(x.room_id)));
create policy "mesaj kalpleri: kişi kendi kalbini geri alır" on public.message_hearts
  for delete to authenticated using (user_id = auth.uid());

revoke all on function public.open_direct_room(uuid) from public, anon;
revoke all on function public.delete_message(uuid) from public, anon;
revoke all on function public.chat_overview() from public, anon;
grant execute on function public.open_direct_room(uuid) to authenticated;
grant execute on function public.delete_message(uuid) to authenticated;
grant execute on function public.chat_overview() to authenticated;

-- ───────────────────────── Storage: chat-files ─────────────────────────
-- Gizli kova; yol "<oda id>/<dosya>". Sadece o odanın üyeleri okur ve yükler.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 20 * 1024 * 1024, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

create or replace function public.is_chat_member_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_first text := (storage.foldername(p_name))[1];
begin
  if v_first !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_chat_member(v_first::uuid);
end;
$$;
revoke all on function public.is_chat_member_path(text) from public, anon;
grant execute on function public.is_chat_member_path(text) to authenticated, service_role;

create policy "sohbet dosyaları: oda üyeleri okur" on storage.objects
  for select to authenticated using (bucket_id = 'chat-files' and public.is_chat_member_path(name));
create policy "sohbet dosyaları: oda üyeleri yükler" on storage.objects
  for insert to authenticated with check (bucket_id = 'chat-files' and public.is_chat_member_path(name));

-- ───────────────────────── Realtime ─────────────────────────
-- Mesajlar ve kalpler anında gelir; RLS'e göre herkes sadece kendi odalarını alır.
alter table public.message_hearts replica identity full;
alter publication supabase_realtime add table public.messages, public.message_hearts;
