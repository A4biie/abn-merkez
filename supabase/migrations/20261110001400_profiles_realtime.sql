-- Profil değişiklikleri canlı (Merkez 0.10.0): profiles tablosu Realtime yayınına eklenir.
-- RLS geçerli: sadece giriş yapmış ekip üyeleri değişiklikleri alır ("profiller: ekip okur").
-- Süresi dolan özel durumu sahibinin uygulaması temizler; bu arada herkes expires_at'e bakıp gizler.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
