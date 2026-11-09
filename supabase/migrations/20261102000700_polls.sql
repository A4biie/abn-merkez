-- ABN Merkez · oylama (akışta post olarak)
--
-- Oylama bir posttur (type = 'oylama'); soru post metnidir, yorum ve kalp aynen çalışır.
-- Ayarlar polls tablosunda, seçenekler poll_options'ta, oylar poll_votes'ta.
-- Oylar tabloya doğrudan yazılamaz ve kimse başkasının oyunu okuyamaz (yöneticiler dahil);
-- oy verme poll_vote(), sonuçlar poll_results() ile. İsimsiz oylamada poll_results kimin neye oy
-- verdiğini hiç döndürmez, sadece toplamları.

alter table public.posts drop constraint posts_type_check;
alter table public.posts add constraint posts_type_check
  check (type in ('paylasim', 'fikrinizi_istiyorum', 'oylama'));

create table public.polls (
  post_id      uuid primary key references public.posts (id) on delete cascade,
  multiple     boolean not null default false,          -- çoklu seçim
  anonymous    boolean not null default false,          -- isimsiz oy
  ends_at      timestamptz,                             -- isteğe bağlı bitiş
  show_results text not null default 'oy_verince' check (show_results in ('oy_verince', 'bitince')),
  closed_at    timestamptz,                             -- erken bitirildiyse
  closed_by    uuid references public.profiles (id) on delete set null,
  notified_at  timestamptz                              -- "Oylama sonuçlandı" bildirimi gitti mi
);

create table public.poll_options (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  image_path text,                                       -- post-files kovasında
  position   int not null,
  unique (post_id, position)
);

create table public.poll_votes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  option_id  uuid not null references public.poll_options (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  multiple   boolean not null,                           -- oylamanın ayarı; tek seçimde kişi başı tek satır
  created_at timestamptz not null default now(),
  unique (option_id, user_id)
);
create unique index poll_votes_tek_secim on public.poll_votes (post_id, user_id) where not multiple;
create index poll_votes_post on public.poll_votes (post_id);

create or replace function public.poll_is_open(p public.polls)
returns boolean language sql stable set search_path = '' as $$
  select p.closed_at is null and (p.ends_at is null or p.ends_at > now());
$$;

-- ───────────────────────── Oluşturma ─────────────────────────

-- Soru ve 2-6 seçenekle oylama postu açar. p_options: [{ "body": "...", "image_path": "..." }]
create or replace function public.create_poll(
  p_question text, p_project uuid, p_options jsonb,
  p_multiple boolean default false, p_anonymous boolean default false,
  p_ends_at timestamptz default null, p_show_results text default 'oy_verince'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_post uuid;
  v_n int := coalesce(jsonb_array_length(p_options), 0);
  i int;
begin
  if auth.uid() is null then raise exception 'Önce giriş yapmalısın.' using errcode = '42501'; end if;
  if coalesce(trim(p_question), '') = '' then
    raise exception 'Oylamanın bir sorusu olsun.' using errcode = '22023';
  end if;
  if v_n < 2 or v_n > 6 then
    raise exception 'Oylamada 2 ile 6 arasında seçenek olmalı.' using errcode = '22023';
  end if;
  if p_ends_at is not null and p_ends_at <= now() then
    raise exception 'Bitiş zamanı ileride olmalı.' using errcode = '22023';
  end if;
  for i in 0 .. v_n - 1 loop
    if coalesce(trim(p_options -> i ->> 'body'), '') = '' then
      raise exception 'Seçeneklerin hepsine bir metin yaz.' using errcode = '22023';
    end if;
  end loop;

  perform set_config('abn.create_poll', 'on', true);
  insert into public.posts (author_id, type, body, project_id)
  values (auth.uid(), 'oylama', trim(p_question), p_project) returning id into v_post;
  perform set_config('abn.create_poll', 'off', true);
  insert into public.polls (post_id, multiple, anonymous, ends_at, show_results)
  values (v_post, p_multiple, p_anonymous, p_ends_at, p_show_results);
  for i in 0 .. v_n - 1 loop
    insert into public.poll_options (post_id, body, image_path, position)
    values (v_post, trim(p_options -> i ->> 'body'), nullif(p_options -> i ->> 'image_path', ''), i + 1);
  end loop;
  return v_post;
end;
$$;

-- ───────────────────────── Oy verme ─────────────────────────

-- Kişinin oyunu verilen seçeneklerle değiştirir. Boş dizi oyunu geri alır.
create or replace function public.poll_vote(p_post uuid, p_options uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_poll public.polls;
  v_n int := coalesce(array_length(p_options, 1), 0);
begin
  if auth.uid() is null then raise exception 'Önce giriş yapmalısın.' using errcode = '42501'; end if;
  select * into v_poll from public.polls where post_id = p_post;
  if v_poll.post_id is null then raise exception 'Oylama bulunamadı.' using errcode = 'P0002'; end if;
  if not public.poll_is_open(v_poll) then
    raise exception 'Bu oylama bitti, oy değiştirilemez.' using errcode = '42501';
  end if;
  if not v_poll.multiple and v_n > 1 then
    raise exception 'Bu oylamada tek seçenek seçilebilir.' using errcode = '22023';
  end if;
  if v_n > 0 and (select count(*) from public.poll_options where post_id = p_post and id = any (p_options)) <> v_n then
    raise exception 'Seçenek bu oylamaya ait değil.' using errcode = '22023';
  end if;

  delete from public.poll_votes where post_id = p_post and user_id = auth.uid();
  insert into public.poll_votes (post_id, option_id, user_id, multiple)
  select p_post, o, auth.uid(), v_poll.multiple from unnest(p_options) as o;
end;
$$;

-- ───────────────────────── Sonuçlar ─────────────────────────

-- Verilen oylamaların seçenek bazında sonucu. votes: sonuç henüz gösterilmiyorsa null.
-- voters: sadece isimli oylamada ve sonuç görünürken dolu. mine: kişinin kendi seçimi.
create or replace function public.poll_results(p_posts uuid[])
returns table (post_id uuid, option_id uuid, votes int, voters uuid[], mine boolean, total_voters int, visible boolean)
language sql stable security definer set search_path = '' as $$
  with p as (
    select pl.*, not public.poll_is_open(pl) as ended,
           exists (select 1 from public.poll_votes v where v.post_id = pl.post_id and v.user_id = auth.uid()) as voted
      from public.polls pl
     where pl.post_id = any (p_posts) and auth.uid() is not null
  ), vis as (
    select p.*, (p.ended or (p.show_results = 'oy_verince' and p.voted)) as visible from p
  )
  select o.post_id, o.id,
         case when vis.visible then (select count(*)::int from public.poll_votes v where v.option_id = o.id) end,
         case when vis.visible and not vis.anonymous
              then (select coalesce(array_agg(v.user_id order by v.created_at), '{}') from public.poll_votes v where v.option_id = o.id) end,
         exists (select 1 from public.poll_votes v where v.option_id = o.id and v.user_id = auth.uid()),
         case when vis.visible then (select count(distinct v.user_id)::int from public.poll_votes v where v.post_id = o.post_id) end,
         vis.visible
    from public.poll_options o
    join vis on vis.post_id = o.post_id
   order by o.post_id, o.position;
$$;

-- ───────────────────────── Bitirme ve bildirim ─────────────────────────

-- Uygulamanın dışından (zamanlanmış iş) bildirim yazmak için; notify() oturum ister.
create or replace function public.notify_system(p_user uuid, p_actor uuid, p_kind text, p_text text, p_link text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user is not distinct from p_actor then return; end if;
  insert into public.notifications (user_id, actor_id, kind, text, link) values (p_user, p_actor, p_kind, p_text, p_link);
end;
$$;
revoke all on function public.notify_system(uuid, uuid, text, text, text) from public, anon, authenticated;

create or replace function public.poll_notify_finished(p_post uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_q text;
begin
  update public.polls set notified_at = now() where post_id = p_post and notified_at is null;
  if not found then return; end if;
  select left(body, 60) into v_q from public.posts where id = p_post;
  for r in select distinct user_id from public.poll_votes where post_id = p_post loop
    perform public.notify_system(r.user_id, p_actor, 'oylama', 'Oylama sonuçlandı: ' || v_q, '/akis?post=' || p_post);
  end loop;
end;
$$;
revoke all on function public.poll_notify_finished(uuid, uuid) from public, anon, authenticated;

-- Oylamayı açan kişi ya da bir yönetici oylamayı erken bitirir.
create or replace function public.poll_close(p_post uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_poll public.polls;
begin
  select * into v_poll from public.polls where post_id = p_post;
  if v_poll.post_id is null then raise exception 'Oylama bulunamadı.' using errcode = 'P0002'; end if;
  if (select author_id from public.posts where id = p_post) is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Oylamayı sadece açan kişi ya da bir yönetici bitirebilir.' using errcode = '42501';
  end if;
  if not public.poll_is_open(v_poll) then
    raise exception 'Bu oylama zaten bitti.' using errcode = '22023';
  end if;
  update public.polls set closed_at = now(), closed_by = auth.uid() where post_id = p_post;
  perform public.poll_notify_finished(p_post, auth.uid());
end;
$$;

-- Bitiş zamanı geçmiş oylamalar için bildirim. Zamanlanmış iş (pg_cron) birkaç dakikada bir çağırır.
create or replace function public.poll_finish_due()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in select post_id from public.polls
            where notified_at is null and closed_at is null and ends_at is not null and ends_at <= now() loop
    perform public.poll_notify_finished(r.post_id, null);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.poll_finish_due() from public, anon, authenticated;

-- pg_cron varsa (Supabase'de var) her 5 dakikada bir. Yerel testte yoksa atlanır.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'oylama-bitis';
    perform cron.schedule('oylama-bitis', '*/5 * * * *', 'select public.poll_finish_due()');
  end if;
end;
$$;

-- ───────────────────────── RLS ─────────────────────────

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy "oylamalar: ekip okur" on public.polls for select to authenticated using (true);
create policy "oylama seçenekleri: ekip okur" on public.poll_options for select to authenticated using (true);
-- poll_votes için hiçbir politika yok: kimse (yöneticiler dahil) tabloyu okuyamaz ya da yazamaz.
-- Oy poll_vote(), sonuç poll_results() ile.

revoke all on function public.create_poll(text, uuid, jsonb, boolean, boolean, timestamptz, text) from public, anon;
revoke all on function public.poll_vote(uuid, uuid[]) from public, anon;
revoke all on function public.poll_results(uuid[]) from public, anon;
revoke all on function public.poll_close(uuid) from public, anon;
grant execute on function public.create_poll(text, uuid, jsonb, boolean, boolean, timestamptz, text) to authenticated;
grant execute on function public.poll_vote(uuid, uuid[]) to authenticated;
grant execute on function public.poll_results(uuid[]) to authenticated;
grant execute on function public.poll_close(uuid) to authenticated;

-- Doğrudan "type = 'oylama'" post açmak yasak; oylama sadece create_poll ile açılır ki ayarı ve
-- seçenekleri olmayan yarım oylama kalmasın.
create or replace function public.guard_poll_post()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.type = 'oylama' and current_setting('abn.create_poll', true) is distinct from 'on'
     and (tg_op = 'INSERT' or old.type is distinct from 'oylama') then
    raise exception 'Oylama sadece oylama formuyla açılır.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.type = 'oylama' and new.type <> 'oylama' then
    raise exception 'Oylamanın türü değiştirilemez.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger posts_guard_poll before insert or update of type on public.posts
  for each row execute function public.guard_poll_post();

-- ───────────────────────── Storage: post-files ─────────────────────────
-- Oylama seçeneği görselleri (logo, kapak). Gizli kova, ekip okur; yol "<kişi id>/<dosya>".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-files', 'post-files', false, 10 * 1024 * 1024, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "post dosyaları: ekip okur" on storage.objects
  for select to authenticated using (bucket_id = 'post-files');
create policy "post dosyaları: kişi kendi klasörüne yükler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Oylama sonuçları değişince akış yenilensin (sadece sayılar; kimin oy verdiği gitmez).
alter publication supabase_realtime add table public.polls;
