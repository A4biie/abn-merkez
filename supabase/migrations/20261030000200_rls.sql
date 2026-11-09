-- ABN Merkez · satır düzeyi güvenlik (RLS)
-- Kural özeti:
--   · Her şey için giriş şart; anon rolü hiçbir tabloyu göremez.
--   · Okuma ekip içinde serbest (kâr payı ve bildirimler hariç: onlar kişiye özel).
--   · Kişi kendi profilini, postunu, yorumunu, kalbini, fikrini düzenler.
--   · Projeler, üyelikler, kilometre taşları, kilitler, duyurular ve istek kararları admin işi.
--   · Görevi "bende"ye almak yalnızca claim_task() ile olur.
--   · Pano öğelerini proje üyeleri, projesiz panolarda herkes düzenler.

do $$
declare t text;
begin
  foreach t in array array['profiles', 'profit_shares', 'projects', 'project_members', 'milestones',
                           'tasks', 'requests', 'posts', 'comments', 'ideas', 'hearts',
                           'announcements', 'notifications', 'boards', 'board_items', 'board_links']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ───────────────────────── profiles ─────────────────────────
create policy "profiller: ekip okur" on public.profiles
  for select to authenticated using (true);
create policy "profiller: kişi kendini düzenler" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiller: admin düzenler" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Ekleme handle_new_user tetikleyicisiyle, silme auth.users üzerinden olur.

-- ───────────────────────── profit_shares ─────────────────────────
create policy "kâr payı: kişi kendini, admin herkesi görür" on public.profit_shares
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "kâr payı: admin yazar" on public.profit_shares
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────── projects / members / milestones ─────────────────────────
create policy "projeler: ekip okur" on public.projects
  for select to authenticated using (true);
create policy "projeler: admin yazar" on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "üyelikler: ekip okur" on public.project_members
  for select to authenticated using (true);
create policy "üyelikler: admin yazar" on public.project_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "kilometre taşları: ekip okur" on public.milestones
  for select to authenticated using (true);
create policy "kilometre taşları: admin yazar" on public.milestones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────── tasks ─────────────────────────
create policy "görevler: ekip okur" on public.tasks
  for select to authenticated using (true);

-- Herkes görev ekleyebilir: projesiz ya da üyesi olduğu projeye; havuza ya da kendine.
-- Kilit ayarı ekleme sırasında tasks_guard tetikleyicisinde engellenir.
create policy "görevler: üye ekler" on public.tasks
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      (project_id is null or public.is_project_member(project_id))
      and (assignee_id is null or assignee_id = auth.uid())
    )
  );

-- Admin olmayan kişi sadece kendisindeki görevi günceller (ilerletir, yardım ister,
-- havuza bırakır). Başkasına veremez; havuzdan almak claim_task() ile olur.
create policy "görevler: sahibi günceller" on public.tasks
  for update to authenticated
  using (assignee_id = auth.uid())
  with check (assignee_id = auth.uid() or (assignee_id is null and status = 'havuz'));
create policy "görevler: admin günceller" on public.tasks
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "görevler: admin ya da havuzdaki kendi görevini ekleyen siler" on public.tasks
  for delete to authenticated
  using (public.is_admin() or (created_by = auth.uid() and status = 'havuz'));

-- ───────────────────────── requests ─────────────────────────
create policy "istekler: ekip okur" on public.requests
  for select to authenticated using (true);
create policy "istekler: kişi kendi adına açar" on public.requests
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'bekliyor'
              and decided_by is null and decided_at is null);
create policy "istekler: kişi bekleyen isteğini geri çeker" on public.requests
  for delete to authenticated using (requester_id = auth.uid() and status = 'bekliyor');
create policy "istekler: admin karar verir" on public.requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "istekler: admin siler" on public.requests
  for delete to authenticated using (public.is_admin());

-- ───────────────────────── posts / comments / hearts ─────────────────────────
create policy "paylaşımlar: ekip okur" on public.posts
  for select to authenticated using (true);
create policy "paylaşımlar: kişi kendi adına yazar" on public.posts
  for insert to authenticated with check (author_id = auth.uid());
create policy "paylaşımlar: kişi kendininkini düzenler" on public.posts
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "paylaşımlar: kişi kendininkini, admin herhangisini siler" on public.posts
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy "yorumlar: ekip okur" on public.comments
  for select to authenticated using (true);
create policy "yorumlar: kişi kendi adına yazar" on public.comments
  for insert to authenticated with check (author_id = auth.uid());
create policy "yorumlar: kişi kendininkini düzenler" on public.comments
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "yorumlar: kişi kendininkini, admin herhangisini siler" on public.comments
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy "kalpler: ekip okur" on public.hearts
  for select to authenticated using (true);
create policy "kalpler: kişi kendi kalbini bırakır" on public.hearts
  for insert to authenticated with check (user_id = auth.uid());
create policy "kalpler: kişi kendi kalbini geri alır" on public.hearts
  for delete to authenticated using (user_id = auth.uid());

-- ───────────────────────── ideas ─────────────────────────
create policy "fikirler: ekip okur" on public.ideas
  for select to authenticated using (true);
create policy "fikirler: kişi kendi adına yazar" on public.ideas
  for insert to authenticated with check (author_id = auth.uid());
create policy "fikirler: sahibi ya da admin düzenler" on public.ideas
  for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
create policy "fikirler: sahibi ya da admin siler" on public.ideas
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

-- ───────────────────────── announcements ─────────────────────────
create policy "duyurular: ekip okur" on public.announcements
  for select to authenticated using (true);
create policy "duyurular: admin yazar" on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────── notifications ─────────────────────────
-- Kayıtları tetikleyiciler (security definer) açar; kişi sadece kendininkini görür,
-- okundu işaretler ve siler.
create policy "bildirimler: kişi kendininkini görür" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "bildirimler: kişi okundu işaretler" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bildirimler: kişi kendininkini siler" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ───────────────────────── boards ─────────────────────────
create policy "panolar: ekip okur" on public.boards
  for select to authenticated using (true);
create policy "panolar: herkes genel, üyeler proje panosu açar" on public.boards
  for insert to authenticated
  with check (
    (parent_board_id is null or public.can_edit_board(parent_board_id))
    and (project_id is null or public.is_admin() or public.is_project_member(project_id))
  );
create policy "panolar: düzenleyebilen günceller" on public.boards
  for update to authenticated
  using (public.can_edit_board(id))
  with check (project_id is null or public.is_admin() or public.is_project_member(project_id));
create policy "panolar: düzenleyebilen siler" on public.boards
  for delete to authenticated using (public.can_edit_board(id));

create policy "pano kartları: ekip okur" on public.board_items
  for select to authenticated using (true);
create policy "pano kartları: düzenleyebilen yazar" on public.board_items
  for insert to authenticated with check (public.can_edit_board(board_id));
create policy "pano kartları: düzenleyebilen günceller" on public.board_items
  for update to authenticated
  using (public.can_edit_board(board_id)) with check (public.can_edit_board(board_id));
create policy "pano kartları: düzenleyebilen siler" on public.board_items
  for delete to authenticated using (public.can_edit_board(board_id));

create policy "pano bağlantıları: ekip okur" on public.board_links
  for select to authenticated using (true);
create policy "pano bağlantıları: düzenleyebilen yazar" on public.board_links
  for insert to authenticated with check (public.can_edit_board(board_id));
create policy "pano bağlantıları: düzenleyebilen günceller" on public.board_links
  for update to authenticated
  using (public.can_edit_board(board_id)) with check (public.can_edit_board(board_id));
create policy "pano bağlantıları: düzenleyebilen siler" on public.board_links
  for delete to authenticated using (public.can_edit_board(board_id));

-- ───────────────────────── claim_task ─────────────────────────
-- Görevi havuzdan "bende"ye almanın tek yolu. Alınamıyorsa nedenini Türkçe döndürür;
-- metinler prototype/Desktop.dc.html'deki kilit penceresiyle aynı.
--
-- Dönüş (jsonb):
--   { ok: true,  message }
--   { ok: false, code, title, reason, request_kind, project_id, task_id, request_pending }
--   code: 'yok' | 'alinmis' | 'proje_disi' | 'kilit_rol' | 'kilit_kisi' | 'kilit_admin'
--   request_kind dolu ise ekranda "istek gönder" butonu gösterilir.

create or replace function public.claim_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_me      public.profiles;
  v_task    public.tasks;
  v_project public.projects;
  v_lead    text;
  v_admin   text;
  v_pending boolean;
  v_roles   text;
begin
  if v_uid is null then
    raise exception 'Görev almak için giriş yapmalısın.' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = v_uid;

  -- Aynı görevi aynı anda iki kişi almaya çalışırsa biri beklesin.
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'yok',
      'title', 'Görev bulunamadı',
      'reason', 'Bu görev silinmiş olabilir. Listeyi yenileyip tekrar bakabilirsin.');
  end if;

  if v_task.assignee_id = v_uid then
    return jsonb_build_object('ok', true, 'message', 'Bu görev zaten sende.');
  end if;

  if v_task.status <> 'havuz' or v_task.assignee_id is not null then
    return jsonb_build_object('ok', false, 'code', 'alinmis', 'task_id', v_task.id,
      'title', 'Bu görev artık havuzda değil',
      'reason', 'Az önce başka biri almış olabilir. Havuzda başka görevler de var.');
  end if;

  -- Proje kontrolü (adminler her görevi alabilir; prototipteki canClaim ile aynı)
  if v_task.project_id is not null and not v_me.is_admin
     and not exists (select 1 from public.project_members
                     where project_id = v_task.project_id and user_id = v_uid) then
    select * into v_project from public.projects where id = v_task.project_id;
    select coalesce(nullif(full_name, ''), 'proje yöneticisi') into v_lead
      from public.profiles where id = v_project.lead_id;
    v_lead := coalesce(v_lead, 'proje yöneticisi');
    select exists (select 1 from public.requests
                   where requester_id = v_uid and status = 'bekliyor'
                     and kind = 'proje' and project_id = v_project.id) into v_pending;
    return jsonb_build_object('ok', false, 'code', 'proje_disi',
      'task_id', v_task.id, 'project_id', v_project.id,
      'request_kind', 'proje', 'request_pending', v_pending,
      'title', 'Bu görev ' || v_project.name || ' projesine ait',
      'reason', 'Bu projede olmadığın için şu an alamıyorsun. ' || v_project.name
                || ' projesinde çalışmak istersen proje yöneticisi '
                || public.tr_dative(v_lead) || ' istek gönderebilirsin.');
  end if;

  -- Kilit kontrolü
  if not v_me.is_admin and v_task.lock_type <> 'yok'
     and not (v_task.lock_type = 'rol' and v_me.role_title = any (v_task.lock_roles))
     and not (v_task.lock_type = 'kisi' and v_uid = any (v_task.lock_people)) then

    select full_name into v_admin from public.profiles
     where is_admin and full_name <> '' order by created_at limit 1;
    v_admin := coalesce(v_admin, 'yönetici');
    select exists (select 1 from public.requests
                   where requester_id = v_uid and status = 'bekliyor'
                     and kind = 'gorev' and task_id = v_task.id) into v_pending;
    v_roles := lower(array_to_string(v_task.lock_roles, ', '));

    return jsonb_build_object('ok', false,
      'code', 'kilit_' || v_task.lock_type,
      'task_id', v_task.id, 'project_id', v_task.project_id,
      'request_kind', 'gorev', 'request_pending', v_pending,
      'title', 'Bu görev şu an kilitli',
      'reason', case v_task.lock_type
                  when 'rol' then
                    case when v_roles = '' then 'Bu göreve henüz rol seçilmedi, şu an kimse alamıyor.'
                         else 'Bu görevi sadece ' || v_roles || ' rolündekiler alabiliyor.' end
                  when 'kisi' then 'Bu görev belirli kişilere ayrıldı.'
                  else 'Bu görevi ' || v_admin || ' atıyor.'
                end
                || ' Almak istersen ' || public.tr_dative(v_admin) || ' istek gönderebilirsin.');
  end if;

  update public.tasks
     set assignee_id = v_uid, status = 'bende'
   where id = v_task.id;

  return jsonb_build_object('ok', true, 'task_id', v_task.id,
    'message', 'Görev artık sende. Kolay gelsin!');
end;
$$;

revoke all on function public.claim_task(uuid) from public, anon;
grant execute on function public.claim_task(uuid) to authenticated;

-- Yardımcı fonksiyonlar RLS içinde kullanılıyor; anon çağıramasın.
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_project_member(uuid) from public, anon;
revoke all on function public.can_edit_board(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_project_member(uuid) to authenticated, service_role;
grant execute on function public.can_edit_board(uuid) to authenticated, service_role;
