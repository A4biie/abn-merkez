-- Mesajı göreve / fikre çevirme (Merkez 0.11 bölüm 3).
-- Görev ve fikir kayıtlarında kaynak mesaj ve mesajı yazan tutulur; sohbetteki bağlantı çipi bunları kullanır.
-- Mesaj silinirse bağlantı boşalır, görev / fikir kalır.

alter table public.tasks
  add column if not exists source_message_id uuid references public.messages (id) on delete set null,
  add column if not exists source_author_id uuid references public.profiles (id) on delete set null;
alter table public.ideas
  add column if not exists source_message_id uuid references public.messages (id) on delete set null,
  add column if not exists source_author_id uuid references public.profiles (id) on delete set null;

create index if not exists tasks_source_message_idx on public.tasks (source_message_id) where source_message_id is not null;
create index if not exists ideas_source_message_idx on public.ideas (source_message_id) where source_message_id is not null;

-- Mesajdan görev: varsayılan kişi mesajı yazan olduğu için görev başkasına atanabilir.
-- Normal eklemede (RLS) yönetici olmayan kişi görevi sadece kendine ya da havuza koyabiliyor; bu fonksiyon
-- sadece mesajdan oluşturmada, kaynak mesajı görebilen (odanın üyesi) kişiye izin verir.
-- Proje seçildiyse oluşturan o projenin üyesi olmalı. Atanan kişiye mevcut "görev atandı" bildirimi gider.
create or replace function public.create_task_from_message(
  p_message uuid,
  p_title text,
  p_assignee uuid,
  p_status text,
  p_project uuid,
  p_due_label text,
  p_due_date date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_author uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş yapmalısın.' using errcode = '42501';
  end if;
  select m.author_id into v_author
    from public.messages m
    join public.chat_members cm on cm.room_id = m.room_id and cm.user_id = auth.uid()
   where m.id = p_message;
  if not found then
    raise exception 'Bu mesajı göremiyorsun.' using errcode = '42501';
  end if;
  if p_project is not null and not (public.is_admin() or public.is_project_member(p_project)) then
    raise exception 'Bu projenin üyesi değilsin.' using errcode = '42501';
  end if;
  if p_status not in ('havuz', 'bende', 'incelemede', 'bitti') then
    raise exception 'Geçersiz sütun.' using errcode = '22023';
  end if;
  if p_assignee is not null and not exists (select 1 from public.profiles where id = p_assignee) then
    raise exception 'Kişi bulunamadı.' using errcode = '22023';
  end if;

  insert into public.tasks (title, project_id, status, assignee_id, created_by, due_label, due_date,
                            source_message_id, source_author_id)
  values (left(trim(p_title), 200), p_project,
          case when p_assignee is null then 'havuz' else p_status end,
          case when p_status = 'havuz' then null else p_assignee end,
          auth.uid(), coalesce(nullif(p_due_label, ''), 'Acelesi yok'), p_due_date, p_message, v_author)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_task_from_message(uuid, text, uuid, text, uuid, text, date) from public, anon;
grant execute on function public.create_task_from_message(uuid, text, uuid, text, uuid, text, date) to authenticated;

-- Fikirler de canlı (Fikir Defteri ve sohbet çipleri herkeste anında).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ideas'
  ) then
    alter publication supabase_realtime add table public.ideas;
  end if;
end $$;
