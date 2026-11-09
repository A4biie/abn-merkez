# Supabase kurulumu

Bu klasördekiler:

| Dosya | Ne yapar |
| --- | --- |
| `migrations/20261030000100_schema.sql` | Tablolar, yardımcı fonksiyonlar, tetikleyiciler (yeni kayıtta profil açma dahil) |
| `migrations/20261030000200_rls.sql` | Satır düzeyi güvenlik kuralları ve `claim_task` fonksiyonu |
| `migrations/20261030000300_storage_realtime.sql` | `avatars`, `banners`, `board-files` kovaları ve pano için Realtime |
| `migrations/20261031000400_notifications.sql` | Bildirim tetikleyicileri, push jetonları, "Nazikçe sor", son yöneticinin korunması |
| `migrations/20261101000500_username_login.sql` | Kullanıcı adı + şifreyle giriş, yöneticinin üye açması ve şifre belirlemesi |
| `migrations/20261102000600_chat.sql` | Sohbet: genel, proje ve özel odalar, mesajlar, kalpler, anma bildirimi, `chat-files` kovası, sessiz saatler |
| `migrations/20261102000700_polls.sql` | Oylama postları: seçenekler, oylar (kimse okuyamaz), sonuç fonksiyonu, bitiş bildirimi (pg_cron), `post-files` kovası |
| `functions/push/` | Android'e push gönderen Edge Function |
| `seed.sql` | Prototipteki örnek veriler (5 kişi, 3 proje, 12 görev, panolar...). Sadece denemek ve testler için; gerçek projeye yükleme. |
| `temizle.sql` | Örnek veriyi siler, sadece senin hesabını bırakır |
| `tests/` | Yerelde `npm run test:db` ile çalışan güvenlik testleri. Supabase'e yüklenmez. |

## Adım adım

### 1. Proje aç

1. https://supabase.com/dashboard adresine gir, **New project** de.
2. Ad: `abn-merkez`. Bölge olarak **Central EU (Frankfurt)** seç; Türkiye'ye en yakını o.
3. Veritabanı şifresini bir yere kaydet (şimdilik kullanmayacağız).
4. Proje hazırlanırken 1-2 dakika bekle.

### 2. Anahtarları `.env` dosyasına yaz

1. Sol menüde **Project Settings → API Keys** (eski arayüzde **API**) sayfasını aç.
2. Proje kökünde `.env.example` dosyasını `.env` adıyla kopyala.
3. **Project URL** değerini `EXPO_PUBLIC_SUPABASE_URL` satırına yaz.
4. **anon public** anahtarını (yeni arayüzde **Publishable key**, `sb_publishable_` ile başlar) `EXPO_PUBLIC_SUPABASE_ANON_KEY` satırına yaz.
5. **service_role / Secret key** değerini hiçbir yere yazma. O anahtar RLS'i atlar, sadece sunucuda kullanılır.

### 3. SQL dosyalarını sırayla çalıştır

Sıra önemli: her dosya bir öncekine dayanıyor.

1. Sol menüde **SQL Editor**'ü aç, **New query** de.
2. `migrations/20261030000100_schema.sql` dosyasının tamamını yapıştır, **Run** de. Altta "Success. No rows returned" görmelisin.
3. Yeni bir sorgu aç, `migrations/20261030000200_rls.sql` için aynısını yap.
4. Yeni bir sorgu aç, `migrations/20261030000300_storage_realtime.sql` için aynısını yap.
5. Yeni bir sorgu aç, `migrations/20261031000400_notifications.sql` için aynısını yap.
6. Yeni bir sorgu aç, `migrations/20261101000500_username_login.sql` için aynısını yap.
7. Aynı şekilde `migrations/20261102000600_chat.sql` ve `migrations/20261102000700_polls.sql`.

Uygulama boş başlar. `seed.sql` prototipteki örnek verilerdir (Ece, Mert, PaleMouth...); gerçek projeye
yükleme. Yüklediysen 6. adımdan sonra `temizle.sql` dosyasını çalıştır: örnek verinin hepsini siler,
sadece senin hesabını bırakır (dosyanın başındaki kullanıcı adını kendininkiyle değiştir).

> Seed ve SQL Editor'den yapılan değişiklikler bildirim üretmez; bildirimler sadece uygulamadan
> yapılan işlerde (yorum, kalp, istek, duyuru, atama, yardım) oluşur.

Bir dosya hata verirse sonrakine geçme; hata mesajını bana gönder.

> Alternatif: Supabase CLI kuruluysa `npx supabase link --project-ref <ref>` ve ardından
> `npx supabase db push` migration'ları aynı sırayla yükler. Seed için yine SQL Editor'ü kullan.

### 4. Kontrol et

- **Table Editor**: 25 tablo görünmeli ve hepsinin yanında RLS etkin yazmalı.
- **Storage**: `avatars`, `banners` (herkese açık), `board-files`, `chat-files` ve `post-files` (gizli) kovaları görünmeli.
- **Database → Publications → supabase_realtime**: `board_items`, `board_links`, `notifications`, `messages`,
  `message_hearts` ve `polls` açık olmalı.
- **Integrations → Cron**: `oylama-bitis` işi 5 dakikada bir çalışır (bitiş zamanı gelen oylamalar için bildirim).
- **Database → Functions**: `claim_task` görünmeli.

### 5. Girişi ayarla (sadece ekip girebilsin)

Giriş kullanıcı adı ve şifreyle yapılır. Supabase hesapları e-postayla tanıdığı için kullanıcı adı
arka planda `<kullanici-adi>@abnmerkez.local` adresine çevrilir. Bu adres gerçek değildir ve hiçbir
e-posta gönderilmez.

1. **Authentication → Sign In / Providers → Email**: açık kalsın (şifreli giriş bu sağlayıcıyla çalışır).
2. Aynı sayfada **Allow new users to sign up** seçeneğini **kapat**. Hesapları sadece yöneticiler açar.
3. Aynı sayfada **Secure password change** kapalı kalsın (varsayılan). Açılırsa şifre değişikliği için
   e-postayla onay ister; adresler gerçek olmadığı için o e-posta hiç gelmez. Uygulama zaten şifre
   değiştirmeden önce mevcut şifreyi soruyor.

Supabase panelinden **Add user** ile hesap açma; e-posta biçimi uymaz. Üyeleri uygulamadan aç:
**Yönetim paneli → Üyeler → Yeni üye**. Şifre unutulursa aynı yerde kişinin satırındaki **Giriş**
butonundan yenisi verilir.

### 6. Kendi hesabını aç

İlk yönetici hesabını SQL Editor'den açarsın; sonraki üyeleri uygulamanın içinden
(**Yönetim paneli → Üyeler → Yeni üye**). `<...>` kısımlarını kendi bilgilerinle değiştirip çalıştır:

```sql
select public.admin_create_member('<kullanici-adin>', '<adin>', '<sifren>');
update public.profiles set is_admin = true where username = '<kullanici-adin>';
```

Sonra uygulamada bu kullanıcı adı ve şifreyle gir. Şifreni profil sayfandaki **Şifremi değiştir**
ile sonradan değiştirebilirsin.

Kullanıcı adı küçük harf, rakam, nokta, alt çizgi ve tireden oluşur (3-32 karakter). Şifre en az
6 karakter olmalı; tahmin edilmesi zor, uzun bir şifre seçmen iyi olur.

> Örnek veriyi (seed.sql) yüklediysen hesap zaten var: Rüzgar'ı kendi hesabın yap, sonra
> `temizle.sql` ile gerisini sil:
>
> ```sql
> select public.admin_set_login(md5('abn:user:ruzgar')::uuid, '<kullanici-adin>', '<sifren>');
> ```

### 7. Telefona push bildirimi (Android)

Uygulama içi zil kendiliğinden çalışır. Telefona bildirim düşmesi için iki adım daha var:

**a) Edge Function'ı yayınla.** Bilgisayarında proje klasöründe:

```bash
npx supabase login
npx supabase link --project-ref <proje-ref>
npx supabase functions deploy push --no-verify-jwt
npx supabase secrets set PUSH_WEBHOOK_SECRET=<uzun-rastgele-bir-metin>
```

`<proje-ref>`, proje adresindeki `https://<proje-ref>.supabase.co` kısmıdır.

**b) Webhook'u kur.** Panelde **Database → Webhooks → Create a new hook**:

- Name: `push`
- Table: `notifications`, Events: yalnızca **Insert**
- Type: **Supabase Edge Functions**, Function: `push`, Method: POST
- HTTP Headers'a ekle: `x-abn-secret` = yukarıda verdiğin `PUSH_WEBHOOK_SECRET`

Telefon, uygulamaya ilk girişte bildirim izni ister; izin verilirse cihaz `push_tokens` tablosuna
kaydolur. Push almak için uygulamanın EAS ile derlenmiş olması gerekir (Aşama 7, `eas init` sonrası).
Moladaki kişiye push gitmez; uygulama içi bildirimi döndüğünde görür.

## Önemli kararlar

- **Durum anahtarları Türkçe ve ASCII:** görev `havuz / bende / incelemede / bitti`, uygunluk
  `musait / yogun / ara`, istek `bekliyor / onaylandi / reddedildi`. Ekrandaki etiketler
  (ör. "Az vaktim var", "Molada") prototipten gelir ve uygulamada eşlenir.
- **Kâr payı ayrı tabloda (`profit_shares`).** Profiller ekipçe okunur ama prototipte
  "Kâr payı bilgisini sadece sen görüyorsun" yazıyor. Kişi kendi oranını, admin herkesinkini görür.
- **Görev almak sadece `claim_task(task_id)` ile.** İstemci `tasks` tablosunda başkasının ya da
  havuzdaki bir görevin sahibini değiştiremez. Fonksiyon `{ ok, title, reason, request_kind }`
  döndürür; `reason` metni prototipteki kilit penceresiyle aynıdır ve isme göre ek alır
  (Rüzgar'a, Ece'ye).
- **Adminler her görevi alabilir** (prototipteki `canClaim` ile aynı).
- **İstek onaylanınca** veritabanı kendisi işler: katılım isteği kişiyi `project_members`'a
  ekler, görev isteği görevi kişiye verir.
- **Kalpler** postlarda ve fikirlerde kullanılır (prototipte Fikir Defteri'nde de kalp var).
- **Aynı anda tek sabit duyuru** olur; yenisi sabitlenince eskisi kalkar.
- **Kişinin rolünü, admin bayrağını ve kullanıcı adını** sadece adminler değiştirir; kişi kendi profilinde bunlara dokunamaz.
- **Hesaplar SQL'den açılır** (`admin_create_member`): şifre `pgcrypto` ile bcrypt olarak `auth.users`'a yazılır. Kullanıcı adı değişince giriş e-postası tetikleyiciyle eşlenir.
- **Bildirimler** tetikleyicilerle açılır; istemci notifications tablosuna yazamaz. Kişi kendi yaptığı
  iş için bildirim almaz. Onaylanan görev isteği için tek bildirim (görev ataması) gider.
- **Ekipte en az bir yönetici kalır**; son yönetici kendi yetkisini bırakamaz.
- **Sohbet odalarına ve üyeliklere istemci yazamaz.** Genel odaya herkes, proje odasına proje üyeleri
  tetikleyiciyle girer; özel oda `open_direct_room()` ile açılır. Yöneticiler de başkalarının özel odasını göremez.
- **"Görüldü" ve "yazıyor..." yok.** Okunmamış noktası için tutulan `chat_reads` sadece kişinin kendisine görünür.
- **Mesaj silmek** `delete_message()` ile: içerik temizlenir, "Mesaj silindi" satırı kalır (yanıt zinciri bozulmasın).
- **Oylar `poll_votes` tablosunda ama kimse okuyamaz** (yöneticiler dahil, politika yok). Oy `poll_vote()`,
  sonuç `poll_results()` ile; isimsiz oylamada fonksiyon kimin neye oy verdiğini hiç döndürmez.
