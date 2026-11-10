-- Profil düzenleme (Merkez 0.10.0): avatar ve banner görselleri en fazla 5 MB.
-- Uygulama görselleri yüklemeden önce webp'ye çevirip küçültüyor (avatar 512 px, banner 1500 px)
-- ve eski dosyayı siliyor. Okuma / yazma kuralları 20261030000300_storage_realtime.sql'de zaten var:
-- herkes okur, kişi sadece kendi klasörüne ("<kullanıcı id>/...") yazar ve oradan siler.

update storage.buckets
   set file_size_limit = 5 * 1024 * 1024,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 where id in ('avatars', 'banners');
