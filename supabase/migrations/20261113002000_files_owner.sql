-- Dosyalar düzeltmesi (Merkez 0.11.1): Storage yeni yüklemelerde yükleyeni owner yerine owner_id'ye yazıyor.
-- Yükleyen "Biri" görünüyordu ve kendi dosyanı silme izni çalışmıyordu. Yeni tablo ya da kolon yok.

create or replace function public.list_files()
returns table (
  bucket text, path text, name text, mime text, size bigint, created_at timestamptz, uploaded_by uuid,
  source text, source_label text, source_id uuid, source_ref uuid
)
language sql stable security definer set search_path = '' as $$
  select o.bucket_id, o.name,
         case m.attachment_kind when 'gorsel' then 'Görsel' when 'ses' then 'Ses kaydı' else 'Dosya' end
           || ' · ' || to_char(o.created_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI'),
         o.metadata->>'mimetype', (o.metadata->>'size')::bigint, o.created_at, coalesce(coalesce(o.owner, nullif(o.owner_id, '')::uuid), m.author_id),
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
         o.metadata->>'mimetype', (o.metadata->>'size')::bigint, o.created_at, coalesce(coalesce(o.owner, nullif(o.owner_id, '')::uuid), i.created_by),
         'pano', 'Pano · ' || b.title, b.id, i.id
    from storage.objects o
    join public.board_items i on i.data->>'path' = o.name
    join public.boards b on b.id = i.board_id
   where o.bucket_id = 'board-files' and auth.uid() is not null
  union all
  select o.bucket_id, o.name,
         regexp_replace(regexp_replace(o.name, '^.*/', ''), '^[0-9]+-', ''),
         o.metadata->>'mimetype', (o.metadata->>'size')::bigint, o.created_at, coalesce(o.owner, nullif(o.owner_id, '')::uuid),
         'wiki', 'Wiki · ' || w.title, w.id, null::uuid
    from storage.objects o
    join public.wiki_pages w on w.id::text = split_part(o.name, '/', 1)
   where o.bucket_id = 'wiki-files' and auth.uid() is not null
  union all
  select o.bucket_id, o.name,
         regexp_replace(regexp_replace(o.name, '^.*/', ''), '^[0-9]+-', ''),
         o.metadata->>'mimetype', (o.metadata->>'size')::bigint, o.created_at, coalesce(coalesce(o.owner, nullif(o.owner_id, '')::uuid), g.reporter_id),
         'bug', 'Bug B-' || g.number, g.id, null::uuid
    from storage.objects o
    join public.bugs g on g.attachment_path = o.name
   where o.bucket_id = 'bug-files' and auth.uid() is not null;
$$;

create or replace function public.delete_file_source(p_bucket text, p_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  select coalesce(owner, nullif(owner_id, '')::uuid) into v_owner from storage.objects where bucket_id = p_bucket and name = p_path;
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

drop policy if exists "sohbet dosyaları: yükleyen ya da admin siler" on storage.objects;
create policy "sohbet dosyaları: yükleyen ya da admin siler" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-files' and (owner = auth.uid() or owner_id = auth.uid()::text or public.is_admin()));
drop policy if exists "pano dosyaları: yükleyen ya da admin siler" on storage.objects;
create policy "pano dosyaları: yükleyen ya da admin siler" on storage.objects for delete to authenticated
  using (bucket_id = 'board-files' and (owner = auth.uid() or owner_id = auth.uid()::text or public.is_admin()));
drop policy if exists "wiki dosyaları: yükleyen ya da admin siler" on storage.objects;
create policy "wiki dosyaları: yükleyen ya da admin siler" on storage.objects for delete to authenticated
  using (bucket_id = 'wiki-files' and (owner = auth.uid() or owner_id = auth.uid()::text or public.is_admin()));
drop policy if exists "bug dosyaları: yükleyen ya da admin siler" on storage.objects;
create policy "bug dosyaları: yükleyen ya da admin siler" on storage.objects for delete to authenticated
  using (bucket_id = 'bug-files' and (owner = auth.uid() or owner_id = auth.uid()::text or public.is_admin()));
