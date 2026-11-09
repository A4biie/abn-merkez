# ABN Merkez

Abby's Nexus'un ekip paneli: akış, görevler, projeler, panolar, fikir defteri, ekip ve yönetim paneli.
Webde (Vercel) ve Android'de (APK) çalışır.

Uygulama Expo (SDK 58), Expo Router, TypeScript ve Supabase ile yazıldı. Geliştirici notları
`CLAUDE.md` içinde, veritabanı kurulumu `supabase/README.md` içinde.

## Gerekenler

- Node.js 20 veya üstü (`node -v` ile bak)
- Ücretsiz hesaplar:
  - [Supabase](https://supabase.com)
  - [GitHub](https://github.com)
  - [Vercel](https://vercel.com)
  - [Expo](https://expo.dev); sadece Android APK için gerekir.

## 1. Bilgisayarında çalıştır

```bash
npm install
```

`.env.example` dosyasını `.env` adıyla kopyala ve Supabase değerlerini yaz (bkz. 2. adım), sonra:

```bash
npm run web
```

Tarayıcıda http://localhost:8081 açılır.

## 2. Supabase

Veritabanı kurulumunun tamamı `supabase/README.md` içinde: proje açma, SQL dosyalarını sırayla
çalıştırma, girişi ayarlama ve kendi hesabını açma. Önce onu bitir.

Giriş kullanıcı adı ve şifreyle yapılır. Hesapları yöneticiler uygulamanın içinden açar:
**Yönetim paneli → Üyeler → Yeni üye**. Şifresini unutan kişiye aynı yerden yenisi verilir.
Herkes kendi şifresini profil sayfasındaki **Şifremi değiştir** butonuyla değiştirebilir.

## 3. Kodu GitHub'a koy

Vercel kodu GitHub'dan çeker. GitHub'da boş bir depo aç (ör. `abn-merkez`, **Private** önerilir), sonra
proje klasöründe:

```bash
git init
git add .
git commit -m "ABN Merkez"
git branch -M main
git remote add origin https://github.com/<kullanici-adin>/abn-merkez.git
git push -u origin main
```

`.env` dosyası `.gitignore` içinde, GitHub'a gitmez. Anahtarları 4. ve 5. adımda ayrıca gireceğiz.

## 4. Web: Vercel

1. https://vercel.com/new adresinde **Import Git Repository** ile `abn-merkez` deposunu seç.
2. **Framework Preset**: `Other` kalsın. Derleme ayarları `vercel.json` içinde hazır:
   - Komut: `npm run build:web`
   - Çıktı klasörü: `dist`
3. **Environment Variables** bölümüne iki değişken ekle (değerler `.env` dosyandakilerle aynı):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy** de. 1-2 dakikada `https://<proje-adi>.vercel.app` adresi verilir.

Bundan sonra GitHub'a her `git push` yaptığında Vercel siteyi kendiliğinden yeniler.

> Bu değişkenler derleme sırasında koda gömülür. Vercel'de bir değeri değiştirirsen
> **Deployments → son kayıt → ⋯ → Redeploy** ile yeniden derlemen gerekir.

**Telefona uygulama gibi eklemek (PWA):** Site telefonda açıkken tarayıcı menüsünden
**Ana ekrana ekle** de. ABN Merkez simgesiyle, adres çubuğu olmadan açılır.

Derlemeyi yayına almadan bilgisayarında denemek için:

```bash
npm run build:web
```

```bash
npm run serve:web
```

http://localhost:8090 açılır. Bu yerel sunucuda sayfa yenileyince 404 görebilirsin; Vercel'de
`vercel.json` bunu çözüyor.

## 5. Android: APK

APK'yı Expo'nun bulut derleme servisi (EAS) hazırlar; bilgisayarına Android Studio kurman gerekmez.

**Bir kerelik hazırlık:**

```bash
npm install -g eas-cli
```

```bash
eas login
```

```bash
eas init
```

`eas init` projeyi Expo hesabına bağlar ve `app.json` içine `extra.eas.projectId` ekler. Push
bildirimleri bu kimliğe ihtiyaç duyar. Değişikliği kaydet:

```bash
git add app.json
git commit -m "EAS projesi"
```

Supabase değerlerini EAS'a gir (`.env` dosyası buluta gitmez):

```bash
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxxxxxx.supabase.co" --visibility plaintext
```

```bash
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "anon-anahtarin" --visibility plaintext
```

Anon anahtarı zaten uygulamanın içinde gömülü durur, gizli değildir. Asıl gizli anahtar
`service_role`'dür ve hiçbir yere girilmez.

**APK derle:**

```bash
eas build -p android --profile preview
```

Aynı komut `npm run build:apk` olarak da var. İlk derlemede imza anahtarı sorulursa **Yes** de;
EAS kendisi üretip saklar. Derleme 10-20 dakika sürer. Bitince terminalde bir bağlantı ve QR kod
çıkar.

**Telefona kur:**

1. Bağlantıyı telefonda aç ve `.apk` dosyasını indir.
2. Android "bilinmeyen kaynak" uyarısı verirse, o tarayıcı için **Bu kaynağa izin ver** de.
3. Kur, aç ve kullanıcı adın ile şifrenle gir.

Kodu her değiştirdiğinde yeni APK için `eas build` komutunu tekrar çalıştır ve yeni dosyayı kur;
veriler Supabase'de durduğu için kaybolmaz.

**Push bildirimleri:** `supabase/README.md` 7. adımı izle: Edge Function'ı yayınla ve webhook'u kur.
Bunun için `eas init` yapılmış olmalı. Uygulama ilk açılışta bildirim izni ister.

## 6. Masaüstü: ABN Launcher (Windows)

ABN Launcher, ABN Merkez'i masaüstünde açar; ABN oyunlarını kurar, günceller ve başlatır. Tauri 2 ile
yazıldı (`src-tauri/`), arayüzü Merkez'in web derlemesi. **Bilgisayarında Rust gerekmez:** Windows
kurulumunu GitHub Actions derler (`.github/workflows/desktop.yml`).

Sürümler ayrı takip edilir: Merkez'in sürümü `app.json`'da, Launcher'ınki `src-tauri/tauri.conf.json`'da.
İkisi aynı kurulum dosyasıyla gelir.

### Ekip için kurulum

1. Şu sayfadan en yeni sürümü aç: `https://github.com/<kullanici-adin>/abn-merkez/releases/latest`
2. **ABN Launcher_x.y.z_x64-setup.exe** dosyasını indir ve çift tıkla.
3. Windows büyük ihtimalle mavi bir pencereyle uyaracak: **"Windows bilgisayarınızı korudu"**.
   Uygulama henüz imzalı olmadığı için çıkıyor; tehlikeli değil. Adım adım:
   - **Ekran 1 · "Windows bilgisayarınızı korudu"**: Pencerede sadece **Çalıştırma** butonu görünür.
     Ona basma. Yazının altındaki **Ek bilgi** bağlantısına tıkla.
   - **Ekran 2 · Ek bilgi açıldı**: Pencerede "Uygulama: ABN Launcher_…_x64-setup.exe" ve "Yayımcı:
     Bilinmeyen yayımcı" satırları belirir, altta yeni bir buton çıkar: **Yine de çalıştır**. Ona bas.
   - **Ekran 3 · Kurulum**: Türkçe kurulum açılır. **İleri → Yükle → Bitir**. Yönetici izni istemez,
     sadece senin kullanıcına kurulur.
   - Tarayıcı indirmeyi "yaygın olarak indirilmeyen dosya" diye tutarsa: indirmeler listesinde dosyanın
     yanındaki **⋯ → Sakla → Yine de sakla**.
4. ABN Launcher açılır. Merkez'e ilk kez girmek için ana sayfada **Merkez'i aç**, sonra kullanıcı adın ve
   şifrenle giriş yap. Launcher bundan sonra kendini otomatik günceller.

Launcher kapat butonuyla kapanmaz, saatin yanındaki tepside bekler (Ayarlar'dan değiştirilebilir).
Tamamen çıkmak için tepsideki ABN simgesine sağ tıkla → **Çıkış**. Her yerden **Ctrl+Shift+Space** hızlı
fikir penceresini açar.

### İlk kurulum (bir kez)

1. **GitHub deposu** (3. adım) hazır olmalı. Etiket gönderilince derleme başlar.
2. **Güncelleme imza anahtarı** zaten oluşturuldu: `C:\Users\<sen>\.tauri\abn-launcher.key` (gizli,
   projede değil; yedekle, kaybolursa kurulu launcher'lar yeni güncellemeleri kabul etmez).
   Yeniden oluşturmak gerekirse: `npx tauri signer generate -w %USERPROFILE%\.tauri\abn-launcher.key`
   ve çıkan açık anahtarı `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`'e yaz.
3. GitHub'da depo → **Settings → Secrets and variables → Actions → New repository secret**:

   | Ad | Değer |
   | --- | --- |
   | `TAURI_SIGNING_PRIVATE_KEY` | `abn-launcher.key` dosyasının içeriği. Panoya kopyalamak için PowerShell: `Get-Content $env:USERPROFILE\.tauri\abn-launcher.key \| Set-Clipboard` |
   | `EXPO_PUBLIC_SUPABASE_URL` | `.env`'deki değer |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env`'deki değer |

   Anahtar şifresiz oluşturulduysa `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` gerekmez.
4. **Sihirli bağlantı (abn://)**: Supabase → Authentication → URL Configuration → **Redirect URLs**'e
   `abn://giris` ekle. Not: Hesaplar kullanıcı adıyla açıldığı için e-postaları `@abnmerkez.local`;
   sihirli bağlantı, davet ve şifre sıfırlama e-postaları ancak gerçek e-postası olan hesaplara gider.

### Yeni Launcher sürümü

```bash
npm run release 1.0.1
```

Sürümü yükseltir, CHANGELOG'a `## Launcher 1.0.1` bölümünü ekler (son sürümden beri commit başlıkları;
istersen önce bölümü kendin yaz, komut onu korur), commit atar, `v1.0.1` etiketini GitHub'a gönderir.
Derlemeyi GitHub'da deponun **Actions** sekmesinden izle (yaklaşık 10-15 dakika); bitince kurulum
dosyaları **Releases** sayfasında olur ve açık launcher'lar güncellemeyi kendileri görür.

### Yeni oyun ya da demo yayınlamak

1. **Unity → File → Build Settings → Windows, x86_64 → Build.** Boş bir klasöre build al
   (ör. `D:\Builds\PaleMouth`); içinde `PaleMouth.exe`, `PaleMouth_Data` vb. olur.
2. `.env.local` dosyasına Supabase **service_role** anahtarını ekle (Supabase → Project Settings → API;
   gizli, kimseyle paylaşma):
   ```
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
3. Yayınla (zip'leme, sha256, yükleme ve games.json tek komutta):
   ```bash
   npm run publish-game -- --id palemouth --ad "PaleMouth" --tur "Psikolojik korku · görsel roman" --surum 0.3.0 --exe PaleMouth.exe --klasor "D:\Builds\PaleMouth" --kapak kapak.png
   ```
   - Yeni sürümde aynı komutu yeni `--surum` ile çalıştır; kurulu olanlarda kartta **Güncelle** çıkar
     (otomatik güncelleme açıksa arka planda iner).
   - Sadece "Yakında" kartı eklemek için: `npm run publish-game -- --id dedektif --ad "Dedektif Antolojisi" --tur Gizem --durum yakinda`
   - **Ücretsiz Supabase planında dosya başına sınır 50 MB.** Zip daha büyükse onu bir GitHub Release'e
     yükle ve adresini ver: `--zip "D:\pm.zip" --zip-url https://github.com/.../pm.zip` (sha256 yine
     yerel zip'ten hesaplanır).

## Sık karşılaşılan sorunlar

| Ne oluyor | Ne yapmalı |
| --- | --- |
| "Supabase ayarları eksik" yazıyor | Vercel'de ya da EAS'ta iki değişken eksik. Ekle; Vercel'de **Redeploy**, Android'de yeniden `eas build`. |
| "Kullanıcı adı ya da şifre yanlış" | Bir yönetici Yönetim paneli → Üyeler'de kişinin satırındaki **Giriş** butonundan yeni şifre verir. Hiç yönetici giremiyorsa `supabase/README.md` 6. adımdaki SQL ile şifreyi yeniden belirle. |
| "Kısa sürede çok deneme yapıldı" | Supabase art arda hatalı denemeleri bir süre durdurur. Birkaç dakika bekle. |
| Push gelmiyor | `eas init` yapıldı mı? Edge Function ve webhook kuruldu mu? Kişinin durumu "Molada" ise push bilerek gönderilmez. |

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm run web` | Webde geliştirme sunucusu (8081) |
| `npm run lint` | Kod denetimi |
| `npm run typecheck` | Tip kontrolü |
| `npm run test:db` | Veritabanı güvenlik testleri (Docker gerekmez) |
| `npm run build:web` | Web derlemesi `dist/` klasörüne |
| `npm run serve:web` | `dist/`'i yerelde açar (8090) |
| `npm run build:apk` | Android APK (EAS, preview profili) |
| `npm run build:desktop` | Launcher için web derlemesi (`dist/`, GitHub Actions kullanır) |
| `npm run release 1.0.1` | Yeni ABN Launcher sürümü: sürüm, CHANGELOG, commit, etiket, push |
| `npm run publish-game -- …` | Oyun ya da demo yayınlar (bkz. 6. adım) |
| `npm run icons` | Uygulama, web ve tepsi ikonlarını logodan yeniden çizer |
