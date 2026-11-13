-- Bug takibi (Merkez 0.11 bölüm 6): buglar, buildler, durum geçmişi, ekran görüntüsü kovası, bildirimler.
-- Okuma: ekip. Bildirme ve kendine atama: herkes. Kapatma: bildiren, atanan ya da yönetici. Silme: yönetici.
-- Durum değişiklikleri bug_action() ile yapılır ve her biri geçmişe yazılır.

create table public.builds (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete cascade,
  version     text not null check (char_length(trim(version)) between 1 and 32),
  notes       text not null default '' check (char_length(notes) <= 2000),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create unique index builds_project_version on public.builds (coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), version);

create table public.bugs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references public.projects (id) on delete cascade,
  number            int not null,
  title             text not null check (char_length(trim(title)) between 1 and 200),
  steps             text[] not null default '{}',
  severity          text not null default 'orta' check (severity in ('kritik', 'orta', 'kucuk')),
  status            text not null default 'yeni' check (status in ('yeni', 'atandi', 'duzeltildi', 'test', 'kapandi')),
  build_id          uuid references public.builds (id) on delete set null,     -- bulunduğu build
  fixed_build_id    uuid references public.builds (id) on delete set null,     -- düzeltmenin girdiği build
  reporter_id       uuid references public.profiles (id) on delete set null,
  assignee_id       uuid references public.profiles (id) on delete set null,
  device            text not null default '' check (char_length(device) <= 200),
  attachment_path   text,                                                       -- bug-files kovasında
  attachment_kind   text check (attachment_kind in ('gorsel', 'video')),
  via               text not null default 'web' check (via in ('web', 'sohbet', 'launcher')),
  source_message_id uuid references public.messages (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  closed_at         timestamptz
);
create unique index bugs_project_number on public.bugs (coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), number);
create index bugs_status_idx on public.bugs (status);
create index bugs_source_message_idx on public.bugs (source_message_id) where source_message_id is not null;

create table public.bug_events (
  id         uuid primary key default gen_random_uuid(),
  bug_id     uuid not null references public.bugs (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  text       text not null,
  created_at timestamptz not null default now()
);
create index bug_events_bug_idx on public.bug_events (bug_id, created_at);

alter table public.builds enable row level security;
alter table public.bugs enable row level security;
alter table public.bug_events enable row level security;
create policy "buildler: ekip okur" on public.builds for select to authenticated using (true);
create policy "buglar: ekip okur" on public.bugs for select to authenticated using (true);
create policy "buglar: admin siler" on public.bugs for delete to authenticated using (public.is_admin());
create policy "bug geçmişi: ekip okur" on public.bug_events for select to authenticated using (true);
-- Ekleme ve güncelleme sadece aşağıdaki fonksiyonlarla (numara, yetki ve geçmiş orada).

-- Bildirim türü: bug.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('yorum', 'kalp', 'istek_cevap', 'istek', 'duyuru', 'gorev_atama', 'yardim', 'soru',
                  'anma', 'oylama', 'bug', 'diger'));

-- Bug bildir. Mesajdan bildirilirse bildiren mesajı yazandır (mesajı görebilen, yani odanın üyesi olan kişi bildirebilir).
create or replace function public.report_bug(
  p_title text, p_steps text[], p_severity text, p_build uuid, p_project uuid,
  p_attachment_path text, p_attachment_kind text, p_device text, p_via text, p_message uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_reporter uuid := auth.uid();
  v_num int;
  v_id uuid;
  v_via text := coalesce(p_via, 'web');
begin
  if auth.uid() is null then
    raise exception 'Giriş yapmalısın.' using errcode = '42501';
  end if;
  if p_message is not null then
    select m.author_id into v_reporter
      from public.messages m
      join public.chat_members cm on cm.room_id = m.room_id and cm.user_id = auth.uid()
     where m.id = p_message;
    if not found then
      raise exception 'Bu mesajı göremiyorsun.' using errcode = '42501';
    end if;
    v_reporter := coalesce(v_reporter, auth.uid());
    v_via := 'sohbet';
  end if;
  -- Proje başına sırayla numara (B-1, B-2…). Aynı anda iki bildirim çakışmasın diye kilit.
  perform pg_advisory_xact_lock(hashtext('bugs:' || coalesce(p_project::text, '-')));
  select coalesce(max(number), 0) + 1 into v_num from public.bugs
   where project_id is not distinct from p_project;

  insert into public.bugs (project_id, number, title, steps, severity, build_id, reporter_id, device,
                           attachment_path, attachment_kind, via, source_message_id)
  values (p_project, v_num, left(trim(p_title), 200), coalesce(p_steps, '{}'), coalesce(p_severity, 'orta'), p_build,
          v_reporter, left(coalesce(p_device, ''), 200), p_attachment_path, p_attachment_kind, v_via, p_message)
  returning id into v_id;

  insert into public.bug_events (bug_id, actor_id, text)
  values (v_id, auth.uid(),
          coalesce((select full_name from public.profiles where id = v_reporter), 'Biri') || ' bildirdi'
          || case v_via when 'launcher' then ' (launcher, F8)' when 'sohbet' then ' (sohbetten)' else '' end);
  return v_id;
end;
$$;
revoke all on function public.report_bug(text, text[], text, uuid, uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.report_bug(text, text[], text, uuid, uuid, text, text, text, text, uuid) to authenticated;

-- Durum geçişleri:
--   take       Yeni / Atandı → Atandı (kendine)                 herkes
--   notbug     Yeni → Kapandı ("Bug değil")                     bildiren, atanan, yönetici
--   fix        Atandı → Düzeltildi                              atanan, yönetici
--   totest     Düzeltildi → Test et (bildirene bildirim)        atanan, yönetici
--   ok         Test et → Kapandı                                bildiren, atanan, yönetici
--   broken     Test et → Atandı ("Hâlâ bozuk", atanana bildirim) herkes
--   reopen     Kapandı → Atandı / Yeni (atanana bildirim)       herkes
create or replace function public.bug_action(p_bug uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bugs;
  me uuid := auth.uid();
  v_name text;
  v_code text;
  v_fix text;
  v_link text;
  can_close boolean;
  can_work boolean;
begin
  if me is null then
    raise exception 'Giriş yapmalısın.' using errcode = '42501';
  end if;
  select * into b from public.bugs where id = p_bug for update;
  if not found then
    raise exception 'Bug bulunamadı.' using errcode = 'P0002';
  end if;
  select coalesce(full_name, 'Biri') into v_name from public.profiles where id = me;
  v_code := 'B-' || b.number;
  v_link := '/buglar?bug=' || b.id;
  can_close := me = b.reporter_id or me = b.assignee_id or public.is_admin();
  can_work := me = b.assignee_id or public.is_admin();

  if p_action = 'take' and b.status in ('yeni', 'atandi') then
    update public.bugs set status = 'atandi', assignee_id = me, updated_at = now() where id = b.id;
    insert into public.bug_events (bug_id, actor_id, text) values (b.id, me, v_name || ' üstlendi');
    perform public.notify(b.reporter_id, me, 'bug', v_name || ', ' || v_code || ' bug''ını üstlendi', v_link);

  elsif p_action = 'notbug' and b.status = 'yeni' and can_close then
    update public.bugs set status = 'kapandi', closed_at = now(), updated_at = now() where id = b.id;
    insert into public.bug_events (bug_id, actor_id, text) values (b.id, me, 'Bug değil, ' || v_name || ' kapattı');

  elsif p_action = 'fix' and b.status = 'atandi' and can_work then
    update public.bugs set status = 'duzeltildi', updated_at = now() where id = b.id;
    insert into public.bug_events (bug_id, actor_id, text) values (b.id, me, 'Düzeltildi, sonraki build''e girecek');

  elsif p_action = 'totest' and b.status = 'duzeltildi' and can_work then
    select version into v_fix from public.builds where id = b.fixed_build_id;
    update public.bugs set status = 'test', updated_at = now() where id = b.id;
    insert into public.bug_events (bug_id, actor_id, text)
    values (b.id, me, coalesce(v_fix || ' çıktı, ', 'Build çıktı, ') || 'teste gönderildi');
    perform public.notify(b.reporter_id, me, 'bug',
      v_code || ' düzeltildi' || coalesce(' (' || v_fix || ')', '') || ', test eder misin?', v_link);

  elsif p_action = 'ok' and b.status = 'test' and can_close then
    update public.bugs set status = 'kapandi', closed_at = now(), updated_at = now() where id = b.id;
    insert into public.bug_events (bug_id, actor_id, text) values (b.id, me, v_name || ' test etti, kapandı');

  elsif p_action = 'broken' and b.status = 'test' then
    update public.bugs set status = 'atandi', fixed_build_id = null, updated_at = now() where id = b.id;
    insert into public.bug_events (bug_id, actor_id, text) values (b.id, me, 'Hâlâ bozuk, ' || v_name || ' yeniden açtı');
    perform public.notify(b.assignee_id, me, 'bug', v_code || ' hâlâ bozuk: ' || b.title, v_link);

  elsif p_action = 'reopen' and b.status = 'kapandi' then
    update public.bugs
       set status = case when assignee_id is null then 'yeni' else 'atandi' end,
           closed_at = null, fixed_build_id = null, updated_at = now()
     where id = b.id;
    insert into public.bug_events (bug_id, actor_id, text) values (b.id, me, v_name || ' yeniden açtı');
    perform public.notify(b.assignee_id, me, 'bug', v_code || ' yeniden açıldı: ' || b.title, v_link);

  else
    raise exception 'Bu işlemi şu an yapamazsın.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.bug_action(uuid, text) from public, anon;
grant execute on function public.bug_action(uuid, text) to authenticated;

-- Yeni build: "Düzeltildi"deki buglar (aynı projede) bu build'e bağlanır.
create or replace function public.create_build(p_project uuid, p_version text, p_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş yapmalısın.' using errcode = '42501';
  end if;
  insert into public.builds (project_id, version, notes, created_by)
  values (p_project, trim(p_version), coalesce(p_notes, ''), auth.uid())
  returning id into v_id;
  with fixed as (
    update public.bugs set fixed_build_id = v_id, updated_at = now()
     where status = 'duzeltildi' and project_id is not distinct from p_project
    returning id
  )
  insert into public.bug_events (bug_id, actor_id, text)
  select id, auth.uid(), trim(p_version) || ' build''ine girdi' from fixed;
  return v_id;
end;
$$;
revoke all on function public.create_build(uuid, text, text) from public, anon;
grant execute on function public.create_build(uuid, text, text) to authenticated;

-- Ekran görüntüsü / video: gizli kova, ekip okur, yol "<kullanıcı id>/<dosya>". Silme: yükleyen ya da yönetici.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bug-files', 'bug-files', false, 50 * 1024 * 1024,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "bug dosyaları: ekip okur" on storage.objects for select to authenticated using (bucket_id = 'bug-files');
create policy "bug dosyaları: kişi kendi klasörüne yükler" on storage.objects for insert to authenticated
  with check (bucket_id = 'bug-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "bug dosyaları: yükleyen ya da admin siler" on storage.objects for delete to authenticated
  using (bucket_id = 'bug-files' and (owner = auth.uid() or public.is_admin()));

-- Dosyalar sayfasına bug dosyaları da girsin.
create or replace function public.list_files()
returns table (
  bucket text, path text, name text, mime text, size bigint, created_at timestamptz, uploaded_by uuid,
  source text, source_label text, source_id uuid, source_ref uuid
)
language sql stable security definer set search_path = '' as $$
  select o.bucket_id, o.name,
         case m.attachment_kind when 'gorsel' then 'Görsel' when 'ses' then 'Ses kaydı' else 'Dosya' end
           || ' · ' || to_char(o.created_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI'),
         o.metadata->>'mimetype', (o.metadata->>'size')::bigint, o.created_at, coalesce(o.owner, m.author_id),
         'sohbet',
         case r.kind when 'ozel' then 'Direkt mesaj' when 'genel' then '#genel'
                     else '#' || coalesce(nullif(r.title, ''), p.name, 'proje') end,
         r.id, m.id
    from storage.objects o
    join public.messages m on m.attachment_path = o.name and m.deleted_at is null
    join public.chat_rooms r on r.id = m.room_id
    left join public.projects p on p.id = r.project_id
   where o.bucket_id = 'chat-files'
     and exists (select 1 from public.chat_members cm where cm.room_id = r.id and cm.user_id = auth.uid())
  union all
  select o.bucket_id, o.name,
         coalesce(nullif(i.data->>'name', ''), regexp_replace(o.name, '^.*/', '')),
         o.metadata->>'mimetype', (o.metadata->>'size')::bigint, o.created_at, coalesce(o.owner, i.created_by),
         'pano', 'Pano · ' || b.title, b.id, i.id
    from storage.objects o
    join public.board_items i on i.data->>'path' = o.name
    join public.boards b on b.id = i.board_id
   where o.bucket_id = 'board-files' and auth.uid() is not null
  union all
  select o.bucket_id, o.name,
         regexp_replace(regexp_replace(o.name, '^.*/', ''), '^[0-9]+-', ''),
         o.metadata->>'mimetype', (o.metadata->>'size')::bigint, o.created_at, o.owner,
         'wiki', 'Wiki · ' || w.title, w.id, null::uuid
    from storage.objects o
    join public.wiki_pages w on w.id::text = split_part(o.name, '/', 1)
   where o.bucket_id = 'wiki-files' and auth.uid() is not null
  union all
  select o.bucket_id, o.name,
         regexp_replace(regexp_replace(o.name, '^.*/', ''), '^[0-9]+-', ''),
         o.metadata->>'mimetype', (o.metadata->>'size')::bigint, o.created_at, coalesce(o.owner, g.reporter_id),
         'bug', 'Bug B-' || g.number, g.id, null::uuid
    from storage.objects o
    join public.bugs g on g.attachment_path = o.name
   where o.bucket_id = 'bug-files' and auth.uid() is not null;
$$;

-- Dosyalar'dan bug ekini silince bug kaydındaki ek de kalkar.
create or replace function public.delete_file_source(p_bucket text, p_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  select owner into v_owner from storage.objects where bucket_id = p_bucket and name = p_path;
  if not found then
    raise exception 'Dosya bulunamadı.' using errcode = 'P0002';
  end if;
  if v_owner is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Bu dosyayı sadece yükleyen ya da yönetici silebilir.' using errcode = '42501';
  end if;
  if p_bucket = 'chat-files' then
    perform set_config('abn.message_delete', 'on', true);
    update public.messages
       set attachment_path = null, attachment_kind = null, attachment_ms = null,
           deleted_at = case when length(trim(body)) = 0 then now() end,
           deleted_by = case when length(trim(body)) = 0 then auth.uid() end
     where attachment_path = p_path;
    perform set_config('abn.message_delete', 'off', true);
  elsif p_bucket = 'board-files' then
    delete from public.board_items where data->>'path' = p_path;
  elsif p_bucket = 'bug-files' then
    update public.bugs set attachment_path = null, attachment_kind = null where attachment_path = p_path;
  end if;
end;
$$;

alter publication supabase_realtime add table public.bugs, public.bug_events, public.builds;
