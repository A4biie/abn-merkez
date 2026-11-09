-- ABN Merkez · Storage kovaları ve Realtime

-- ───────────────────────── Storage ─────────────────────────
-- avatars ve banners herkese açık okunur (profil görselleri <img> ile doğrudan açılsın).
-- Dosya yolu her zaman "<kullanıcı id>/<dosya adı>"; kişi sadece kendi klasörüne yazar.
-- board-files gizli kovadır: sadece giriş yapmış ekip okur, yol "<pano id>/<dosya adı>".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5 * 1024 * 1024,
     array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('banners', 'banners', true, 10 * 1024 * 1024,
     array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('board-files', 'board-files', false, 50 * 1024 * 1024, null)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Pano dosya yolunun ilk parçası uuid değilse false döner (hata fırlatmaz).
create or replace function public.can_edit_board_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_first text := (storage.foldername(p_name))[1];
begin
  if v_first !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.can_edit_board(v_first::uuid);
end;
$$;
revoke all on function public.can_edit_board_path(text) from public, anon;
grant execute on function public.can_edit_board_path(text) to authenticated, service_role;

-- avatars
create policy "avatars: herkes okur" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars: kişi kendi klasörüne yükler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: kişi kendi dosyasını değiştirir" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: kişi kendi dosyasını siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- banners
create policy "banners: herkes okur" on storage.objects
  for select using (bucket_id = 'banners');
create policy "banners: kişi kendi klasörüne yükler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "banners: kişi kendi dosyasını değiştirir" on storage.objects
  for update to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "banners: kişi kendi dosyasını siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);

-- board-files
create policy "pano dosyaları: ekip okur" on storage.objects
  for select to authenticated using (bucket_id = 'board-files');
create policy "pano dosyaları: panoyu düzenleyebilen yükler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'board-files' and public.can_edit_board_path(name));
create policy "pano dosyaları: panoyu düzenleyebilen değiştirir" on storage.objects
  for update to authenticated
  using (bucket_id = 'board-files' and public.can_edit_board_path(name))
  with check (bucket_id = 'board-files' and public.can_edit_board_path(name));
create policy "pano dosyaları: panoyu düzenleyebilen siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'board-files' and public.can_edit_board_path(name));

-- ───────────────────────── Realtime ─────────────────────────
-- Aynı panoyu açan herkes kart ve bağlantı değişikliklerini canlı görür.
-- replica identity full: silme olaylarında board_id de gelsin ki istemci hangi panoya ait
-- olduğunu bilsin.
alter table public.board_items replica identity full;
alter table public.board_links replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.board_items, public.board_links;
