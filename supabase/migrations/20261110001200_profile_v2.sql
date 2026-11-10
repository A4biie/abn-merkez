-- Discord tarzı profil (Merkez 0.10.0): durum, özel durum, zamirler, vurgu rengi, çalışma saatleri.
-- "availability" (müsait / az vaktim var / molada) iş yükü bilgisi olarak kalıyor; "status" anlık durum.

alter table public.profiles
  add column if not exists status text not null default 'online'
    check (status in ('online', 'busy', 'idle', 'invisible')),
  add column if not exists custom_status text not null default ''
    check (char_length(custom_status) <= 60),
  add column if not exists custom_status_emoji text not null default '',
  add column if not exists custom_status_expires_at timestamptz,
  add column if not exists pronouns text not null default ''
    check (char_length(pronouns) <= 20),
  add column if not exists accent_color text
    check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists work_hours text not null default ''
    check (char_length(work_hours) <= 24);

-- Banner rengi: eski hazır adlar ya da serbest #RRGGBB.
alter table public.profiles drop constraint if exists profiles_banner_color_check;
alter table public.profiles add constraint profiles_banner_color_check
  check (banner_color in ('lilac', 'lime', 'cyan', 'gece') or banner_color ~ '^#[0-9A-Fa-f]{6}$');

-- Görünen ad en fazla 32, biyografi en fazla 300 karakter.
alter table public.profiles drop constraint if exists profiles_full_name_len;
alter table public.profiles add constraint profiles_full_name_len check (char_length(full_name) <= 32) not valid;
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len check (char_length(bio) <= 300) not valid;
