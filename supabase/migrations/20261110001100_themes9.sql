-- ABN Merkez 0.8.0 · temalar yenilendi: 9 tema (5'i gradyanlı)
-- Koyu: okyanus, kor, geceyarisi, noirisik, noir · Açık: nane, zeytin, adacayi, pudra
-- Kaldırılanlar: dark, gece, indigo, gunbatimi → geceyarisi; light, gul, tropik → nane.
-- Tema boş (null) = sistem: koyu modda Gece Yarısı, açık modda Nane (uygulama karar verir).

alter table public.profiles drop constraint if exists profiles_theme_check;

update public.profiles set theme = 'geceyarisi' where theme in ('dark', 'gece', 'indigo', 'gunbatimi');
update public.profiles set theme = 'nane' where theme in ('light', 'gul', 'tropik');
update public.profiles set theme = null
  where theme not in ('okyanus', 'kor', 'geceyarisi', 'noirisik', 'noir', 'nane', 'zeytin', 'adacayi', 'pudra');

alter table public.profiles alter column theme drop not null;
alter table public.profiles alter column theme set default null;
alter table public.profiles add constraint profiles_theme_check
  check (theme is null or theme in ('okyanus', 'kor', 'geceyarisi', 'noirisik', 'noir', 'nane', 'zeytin', 'adacayi', 'pudra'));
