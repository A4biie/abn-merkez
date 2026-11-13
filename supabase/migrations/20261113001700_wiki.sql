-- Wiki (Merkez 0.11 bölüm 4): sayfa ağacı, sürüm geçmişi, aynı anda düzenleme koruması, görsel kovası.
-- Okuma ve düzenleme: ekipteki herkes. Silme: sayfayı oluşturan ya da yönetici.

create table public.wiki_pages (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.wiki_pages (id) on delete cascade,
  title       text not null default 'Yeni sayfa' check (char_length(title) between 1 and 120),
  icon        text not null default '' check (char_length(icon) <= 8),
  content     text not null default '',                       -- TipTap HTML
  position    double precision not null default extract(epoch from now()),
  version     int not null default 1,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Şu an düzenleyen (her 30 sn yenilenir; 90 sn'den eskiyse geçersiz sayılır).
  editing_by  uuid references public.profiles (id) on delete set null,
  editing_at  timestamptz
);
create index wiki_pages_parent_idx on public.wiki_pages (parent_id, position);

create table public.wiki_revisions (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references public.wiki_pages (id) on delete cascade,
  version    int not null,
  title      text not null,
  content    text not null,
  edited_by  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index wiki_revisions_page_idx on public.wiki_revisions (page_id, version desc);

alter table public.wiki_pages enable row level security;
alter table public.wiki_revisions enable row level security;

create policy "wiki: ekip okur" on public.wiki_pages for select to authenticated using (true);
create policy "wiki: ekip ekler" on public.wiki_pages for insert to authenticated with check (created_by = auth.uid());
-- Ağaçta taşıma ve "düzenliyor" işareti doğrudan; içerik kaydı save_wiki_page() ile (sürüm kontrolü).
create policy "wiki: ekip düzenler" on public.wiki_pages for update to authenticated using (true) with check (true);
create policy "wiki: oluşturan ya da admin siler" on public.wiki_pages for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());
create policy "wiki geçmişi: ekip okur" on public.wiki_revisions for select to authenticated using (true);

-- Doğrudan güncellemede içerik, başlık, sürüm ve oluşturan değiştirilemez (sadece taşıma ve düzenleme işareti).
create or replace function public.guard_wiki_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('abn.wiki_save', true) = '1' then
    return new;
  end if;
  if new.content is distinct from old.content or new.title is distinct from old.title
     or new.version is distinct from old.version or new.created_by is distinct from old.created_by then
    raise exception 'Sayfayı kaydetmek için save_wiki_page kullanılmalı.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger wiki_pages_guard before update on public.wiki_pages
  for each row execute function public.guard_wiki_update();

-- Kaydet: p_base sayfayı açtığındaki sürüm. Bu arada başkası kaydettiyse 'wiki_conflict' hatası döner
-- (üzerine yazılmaz). Eski içerik her kayıtta geçmişe yazılır, yani hiçbir sürüm kaybolmaz.
create or replace function public.save_wiki_page(p_id uuid, p_title text, p_content text, p_base int)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v public.wiki_pages;
begin
  if auth.uid() is null then
    raise exception 'Giriş yapmalısın.' using errcode = '42501';
  end if;
  select * into v from public.wiki_pages where id = p_id for update;
  if not found then
    raise exception 'Sayfa bulunamadı.' using errcode = 'P0002';
  end if;
  if v.version <> p_base then
    raise exception 'wiki_conflict' using errcode = '40001', detail = v.updated_by::text;
  end if;
  if v.content is distinct from p_content or v.title is distinct from p_title then
    insert into public.wiki_revisions (page_id, version, title, content, edited_by, created_at)
    values (v.id, v.version, v.title, v.content, v.updated_by, v.updated_at);
  end if;
  perform set_config('abn.wiki_save', '1', true);
  update public.wiki_pages
     set title = left(coalesce(nullif(trim(p_title), ''), 'Adsız sayfa'), 120),
         content = p_content,
         version = v.version + 1,
         updated_by = auth.uid(),
         updated_at = now(),
         editing_by = null,
         editing_at = null
   where id = p_id;
  perform set_config('abn.wiki_save', '0', true);
  return v.version + 1;
end;
$$;
revoke all on function public.save_wiki_page(uuid, text, text, int) from public, anon;
grant execute on function public.save_wiki_page(uuid, text, text, int) to authenticated;

-- Eski sürümü geri yükle: şimdiki içerik geçmişe yazılır, seçilen sürüm yeni sürüm olur.
create or replace function public.restore_wiki_revision(p_rev uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  r public.wiki_revisions;
  v int;
begin
  select * into r from public.wiki_revisions where id = p_rev;
  if not found then
    raise exception 'Sürüm bulunamadı.' using errcode = 'P0002';
  end if;
  select version into v from public.wiki_pages where id = r.page_id;
  return public.save_wiki_page(r.page_id, r.title, r.content, v);
end;
$$;
revoke all on function public.restore_wiki_revision(uuid) from public, anon;
grant execute on function public.restore_wiki_revision(uuid) to authenticated;

-- Wiki görselleri: gizli kova, ekip okur, yol "<sayfa id>/<dosya>". Silme: yükleyen ya da yönetici.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wiki-files', 'wiki-files', false, 10 * 1024 * 1024, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "wiki dosyaları: ekip okur" on storage.objects for select to authenticated using (bucket_id = 'wiki-files');
create policy "wiki dosyaları: ekip yükler" on storage.objects for insert to authenticated with check (bucket_id = 'wiki-files');
create policy "wiki dosyaları: yükleyen ya da admin siler" on storage.objects for delete to authenticated
  using (bucket_id = 'wiki-files' and (owner = auth.uid() or public.is_admin()));

alter publication supabase_realtime add table public.wiki_pages;
