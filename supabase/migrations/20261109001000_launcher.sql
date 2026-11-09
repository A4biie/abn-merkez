-- ABN Launcher · oyun listesi ve kapaklar
-- "launcher" kovası herkese açık: launcher games.json'u ve kapakları giriş yapmadan okur.
-- Yazma sadece servis anahtarıyla (scripts/publish-game.mjs); bu yüzden yazma politikası yok.
-- Ücretsiz planda dosya başına sınır 50 MB: oyun zip'leri başka yerde (ör. GitHub Releases) durabilir,
-- games.json'daki "zip" alanı herhangi bir HTTPS adresi olabilir.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('launcher', 'launcher', true, null, null)
on conflict (id) do update set public = true;
