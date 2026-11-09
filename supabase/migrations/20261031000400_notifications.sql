-- ABN Merkez · bildirimler, push jetonları, yönetici yardımcıları
--
-- Bildirimler tetikleyicilerle açılır (security definer); istemci notifications tablosuna yazamaz.
-- Kişi kendi yaptığı iş için bildirim almaz. Metinler prototype/*.html'deki "Son olanlar" diliyle.
-- Telefona push: notifications'a her ekleme bir Database Webhook ile "push" Edge Function'ını çağırır
-- (bkz. supabase/README.md). Moladaki kişiye push gitmez; uygulama içi bildirimi döndüğünde görür.

-- ───────────────────────── Push jetonları ─────────────────────────

create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  platform   text not null default 'android' check (platform in ('android', 'ios', 'web')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon;

create policy "push jetonları: kişi kendininkini görür" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "push jetonları: kişi kendi adına ekler" on public.push_tokens
  for insert to authenticated with check (user_id = auth.uid());
create policy "push jetonları: kişi kendininkini günceller" on public.push_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push jetonları: kişi kendininkini siler" on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

-- ───────────────────────── Yardımcılar ─────────────────────────

create or replace function public.person_name(p_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif((select full_name from public.profiles where id = p_id), ''), 'Biri');
$$;

/**
 * Tek kişiye bildirim; kişi kendisine bildirim almaz. Uygulamadan değil de SQL Editor'den yapılan
 * değişiklikler (ör. seed.sql) bildirim üretmez: auth.uid() boşsa hiçbir şey yapılmaz.
 */
create or replace function public.notify(p_user uuid, p_actor uuid, p_kind text, p_text text, p_link text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_user is null or p_user is not distinct from p_actor then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, kind, text, link)
  values (p_user, p_actor, p_kind, p_text, p_link);
end;
$$;

/** Bütün yöneticilere (yapan hariç). */
create or replace function public.notify_admins(p_actor uuid, p_kind text, p_text text, p_link text)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select id from public.profiles where is_admin loop
    perform public.notify(r.id, p_actor, p_kind, p_text, p_link);
  end loop;
end;
$$;

revoke all on function public.notify(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.notify_admins(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.person_name(uuid) from public, anon;

-- ───────────────────────── Yorum ─────────────────────────

create or replace function public.on_comment_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  perform public.notify(
    v_author, new.author_id, 'yorum',
    public.person_name(new.author_id) || ' paylaşımına yorum yaptı: “' ||
      case when length(new.body) > 60 then left(new.body, 58) || '…' else new.body end || '”',
    '/akis');
  return null;
end;
$$;

create trigger comments_notify after insert on public.comments
  for each row execute function public.on_comment_notify();

-- ───────────────────────── Kalp ─────────────────────────

create or replace function public.on_heart_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if new.post_id is not null then
    select author_id into v_owner from public.posts where id = new.post_id;
    perform public.notify(v_owner, new.user_id, 'kalp',
      public.person_name(new.user_id) || ' paylaşımına kalp bıraktı', '/akis');
  else
    select author_id into v_owner from public.ideas where id = new.idea_id;
    perform public.notify(v_owner, new.user_id, 'kalp',
      public.person_name(new.user_id) || ' fikrine kalp bıraktı', '/fikirler');
  end if;
  return null;
end;
$$;

create trigger hearts_notify after insert on public.hearts
  for each row execute function public.on_heart_notify();

-- ───────────────────────── İstekler ─────────────────────────

create or replace function public.request_subject(r public.requests)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when r.kind = 'proje' then coalesce((select name from public.projects where id = r.project_id), 'Bir') || ' projesine katılma'
    else '“' || coalesce((select title from public.tasks where id = r.task_id), 'Bir görev') || '” görevini alma'
  end;
$$;

-- Yeni istek yöneticilere gider.
create or replace function public.on_request_insert_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_admins(
    new.requester_id, 'istek',
    public.person_name(new.requester_id) || ', ' ||
      case when new.kind = 'proje'
        then coalesce((select name from public.projects where id = new.project_id), 'bir') || ' projesine katılmak istiyor'
        else '“' || coalesce((select title from public.tasks where id = new.task_id), 'bir') || '” görevini almak istiyor'
      end,
    '/yonetim?sekme=istek');
  return null;
end;
$$;

create trigger requests_insert_notify after insert on public.requests
  for each row execute function public.on_request_insert_notify();

-- Karar isteyene nazikçe bildirilir.
create or replace function public.on_request_decided_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Onaylanan görev isteğini görev ataması bildirimi zaten haber verir; ikinci bildirim gitmez.
  if old.status = 'bekliyor' and new.status in ('onaylandi', 'reddedildi')
     and not (new.status = 'onaylandi' and new.kind = 'gorev') then
    perform public.notify(
      new.requester_id, coalesce(new.decided_by, auth.uid()), 'istek_cevap',
      case
        when new.status = 'onaylandi' and new.kind = 'proje'
          then coalesce((select name from public.projects where id = new.project_id), 'Proje') || ' ekibine katıldın. Hoş geldin!'
        else public.request_subject(new) || ' isteğin için şimdilik olmadı dendi. Başka zaman yine sorabilirsin.'
      end,
      case when new.kind = 'proje' then '/projeler' else '/gorevler' end);
  end if;
  return null;
end;
$$;

create trigger requests_decided_notify after update of status on public.requests
  for each row execute function public.on_request_decided_notify();

-- ───────────────────────── Duyurular ─────────────────────────
-- Duyuruyu açan, belirtilmezse giriş yapan yöneticidir.
alter table public.announcements alter column author_id set default auth.uid();

-- Sabitlenen duyuru herkese bildirilir (prototip: "Akışın en üstüne sabitle (herkese bildirim gider)").

create or replace function public.on_announcement_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.pinned and (tg_op = 'INSERT' or not old.pinned) then
    for r in select id from public.profiles loop
      perform public.notify(r.id, coalesce(new.author_id, auth.uid()), 'duyuru', 'Yeni sabit duyuru: ' || new.title, '/akis');
    end loop;
  end if;
  return null;
end;
$$;

create trigger announcements_notify after insert or update of pinned on public.announcements
  for each row execute function public.on_announcement_notify();

-- ───────────────────────── Görevler ─────────────────────────
-- Başkası görevi birine verirse (admin ataması ya da onaylanan görev isteği) o kişiye bildirim gider.
-- Kişinin kendi aldığı görev için bildirim yoktur. Yardım istenince yöneticilere haber gider.

create or replace function public.on_task_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := coalesce(auth.uid(), new.created_by);
begin
  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and new.assignee_id is distinct from v_actor then
    perform public.notify(new.assignee_id, v_actor, 'gorev_atama',
      public.person_name(v_actor) || ' “' || new.title || '” görevini sana verdi', '/gorevler');
  end if;
  if tg_op = 'UPDATE' and new.needs_help and not old.needs_help then
    perform public.notify_admins(coalesce(new.assignee_id, v_actor), 'yardim',
      public.person_name(coalesce(new.assignee_id, v_actor)) || ', “' || new.title || '” görevinde yardım istiyor',
      '/yonetim');
  end if;
  return null;
end;
$$;

create trigger tasks_notify after insert or update of assignee_id, needs_help on public.tasks
  for each row execute function public.on_task_notify();

-- ───────────────────────── "Nazikçe sor" ─────────────────────────
-- Yönetim panelindeki "Dikkat isteyenler": hareketsiz görevin sahibine sadece onun göreceği soru.

create or replace function public.ask_still_yours(p_task_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks;
begin
  if not public.is_admin() then
    raise exception 'Bunu sadece yöneticiler yapabilir.' using errcode = '42501';
  end if;
  select * into v_task from public.tasks where id = p_task_id;
  if not found or v_task.assignee_id is null then
    raise exception 'Görev bulunamadı ya da kimsede değil.' using errcode = 'P0002';
  end if;
  perform public.notify(v_task.assignee_id, auth.uid(), 'soru',
    '“' || v_task.title || '” bir süredir hareketsiz. Hâlâ sende mi?', '/akis');
end;
$$;

revoke all on function public.ask_still_yours(uuid) from public, anon;
grant execute on function public.ask_still_yours(uuid) to authenticated;

-- ───────────────────────── Son yönetici korunur ─────────────────────────

create or replace function public.guard_last_admin()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.is_admin and not new.is_admin
     and not exists (select 1 from public.profiles where is_admin and id <> old.id) then
    raise exception 'Ekipte en az bir yönetici kalmalı.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_last_admin before update of is_admin on public.profiles
  for each row execute function public.guard_last_admin();

-- ───────────────────────── Canlı zil ─────────────────────────
-- Zildeki nokta ve "Son olanlar" yeni bildirim gelince sayfa yenilenmeden güncellensin.
alter publication supabase_realtime add table public.notifications;
