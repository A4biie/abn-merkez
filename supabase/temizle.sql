-- ABN Merkez · örnek veriyi temizleme
--
-- seed.sql'in eklediği her şeyi siler: örnek kişiler (ece, mert, deniz, selin), projeler, görevler,
-- paylaşımlar, yorumlar, fikirler, panolar, duyurular, istekler ve bildirimler.
-- Sadece aşağıda adı yazan hesap (profili, kâr payı satırı ve push kaydı) kalır.
--
-- SQL Editor'de bir kez çalıştırılır. Geri alınamaz.

do $$
declare
  keep_username constant text := 'a4biie';   -- kalacak hesabın kullanıcı adı
  keep uuid;
begin
  select id into keep from public.profiles where username = keep_username;
  if keep is null then
    raise exception 'Kullanıcı adı "%" bulunamadı; hiçbir şey silinmedi.', keep_username;
  end if;
  if not (select is_admin from public.profiles where id = keep) then
    raise exception '"%" yönetici değil; hiçbir şey silinmedi.', keep_username;
  end if;

  -- İçerik (alt kayıtlar on delete cascade ile gider)
  delete from public.notifications;
  delete from public.requests;
  delete from public.messages;       -- sohbet mesajları ve mesaj kalpleri
  delete from public.posts;          -- yorumlar, paylaşım kalpleri ve oylamalar
  delete from public.ideas;          -- fikir kalpleri
  delete from public.announcements;
  delete from public.boards;         -- alt panolar, kartlar, bağlantılar
  delete from public.tasks;
  delete from public.projects;       -- üyeler ve kilometre taşları

  -- Örnek kişiler (profil, kâr payı ve push kayıtları cascade ile gider)
  delete from auth.users where id <> keep;
end;
$$;

-- Kontrol: hepsi 0 olmalı, kisi 1.
select
  (select count(*) from public.profiles)      as kisi,
  (select count(*) from public.projects)      as proje,
  (select count(*) from public.tasks)         as gorev,
  (select count(*) from public.posts)         as paylasim,
  (select count(*) from public.ideas)         as fikir,
  (select count(*) from public.boards)        as pano,
  (select count(*) from public.announcements) as duyuru,
  (select count(*) from public.requests)      as istek;
