-- ABN Merkez 0.7.0 · temalar 4'e indi
-- Kalanlar: ABN Koyu (dark), Gece (gece), ABN Açık (light), Adaçayı (adacayi).
-- Kaldırılmış bir temayı seçmiş kişi ABN Koyu'ya döner.

update public.profiles set theme = 'dark' where theme not in ('dark', 'gece', 'light', 'adacayi');

alter table public.profiles drop constraint profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check
  check (theme in ('dark', 'gece', 'light', 'adacayi'));
