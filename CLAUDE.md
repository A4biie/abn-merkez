# ABN Merkez

Abby's Nexus (ABN) gönüllü ve kâr paylaşımlı çalışan küçük bir indie ekip. ABN Merkez, ekibin
akışını, görevlerini, projelerini, panolarını, fikirlerini ve üyelerini tek yerde toplayan uygulama.
Aynı kod hem web'e (Vercel) hem Android APK'ya (EAS) çıkar. iOS şimdilik yok.

## Temel ilke

Uygulama çalışanları zorlamaz. Sayaç, sıralama, liderlik tablosu, utandırma yok. Kalplerde sayı
gösterilmez, kimin beğendiği küçük avatarlarla görünür. Hatırlatmalar nazik ve kapatılabilir.
Yönetim panelinde bile kişiler arası karşılaştırma yapılmaz. Yeni bir özellik bu ilkeyle
çelişiyorsa yapılmaz, önce sorulur.

## Tasarım kaynağı

`prototype/` klasörü tasarım ve davranış için tek doğru kaynak. Renk, boşluk, metin ve akışlar
oradan alınır; yeni tasarım uydurulmaz.

- `Main.dc.html`: telefon sürümü (<900px)
- `Desktop.dc.html`: bilgisayar sürümü ve yönetim paneli
- `Board.dc.html`: Milanote benzeri pano
- `themes.css`: 11 tema (dark, light, indigo, gul, zeytin, adacayi, tropik, gunbatimi, gece, pudra, noir)

Uygulamadaki bütün metinler Türkçe.

## Teknoloji

- Expo SDK 58, Expo Router (dosya tabanlı yönlendirme), TypeScript (strict)
- Supabase (`@supabase/supabase-js`): veri, giriş (kullanıcı adı + şifre; kullanıcı adı `<ad>@abnmerkez.local` e-postasına çevrilir, hesapları yönetici açar), Storage, Realtime
- `react-native-reanimated` animasyonlar, `react-native-gesture-handler` hareketler
- Yazı tipi Urbanist (`@expo-google-fonts/urbanist`)
- Web çıktısı `single` (SPA), Vercel'e statik olarak gider

Paket eklerken her zaman `npx expo install <paket>` kullan; SDK ile uyumlu sürümü o seçer.
Expo her SDK'da API değiştirir; ezberden yazmadan önce https://docs.expo.dev/versions/v58.0.0/ belgelerine bak.

## Klasör yapısı

```
app/          Expo Router ekranları. Her dosya bir yol, _layout.tsx gezinmeyi tanımlar.
components/   Ekranlar arası paylaşılan bileşenler
lib/          supabase.ts istemcisi, queries.ts sorguları, yardımcılar
theme/        themes.ts (11 tema), ThemeProvider, useTheme
supabase/     migrations/ (SQL şema + RLS), seed.sql (sadece deneme/test verisi), temizle.sql, functions/
prototype/    Claude Design prototipi (salt okunur kaynak)
assets/       ikonlar ve açılış görselleri (logodan üretildi: lila zemin, koyu üçgen)
public/       web şablonu, PWA manifest ve ikonları (derlemede dist/'e kopyalanır)
```

Yol takma adı: `@/` proje köküne gider (`@/lib/supabase`).

## Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyala. `.env` git'e girmez.

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Oturum webde `localStorage`'da, Android'de `AsyncStorage`'da tutulur (`lib/supabase.ts`).

## Komutlar

```
npx expo start --web     web'de geliştirme
npx expo start           Android (geliştirme derlemesi ile)
npx expo lint            lint
npx tsc --noEmit         tip kontrolü
npx expo-doctor          bağımlılık ve ayar sorunları
npm run test:db          migration + seed + RLS testleri (PGlite, Docker gerekmez)
npm run build:web        web derlemesi dist/ klasörüne (Vercel bunu çalıştırır)
npm run serve:web        dist/'i yerelde 8090 portunda açar
npm run build:apk        EAS ile Android APK (preview profili)
```

Yayına alma (Vercel, EAS) adımları kökteki `README.md` içinde. Web `"output": "single"` ile tek sayfa
uygulama olarak derlenir; `public/index.html` HTML şablonu, `public/manifest.webmanifest` PWA bildirimi.
`vercel.json` her yolu `index.html`'e yönlendirir.

Veritabanını değiştiren her iş yeni bir migration dosyasıyla yapılır ve `supabase/tests/rls.test.mjs`
içine senaryosu eklenir. Supabase'e yükleme adımları `supabase/README.md` içinde.

Bir işi bitti saymadan önce lint ve tip kontrolünü çalıştır.

## Arayüz yapı taşları

- Renkler her zaman temadan: `useTheme().colors['text-2']` gibi, token adları `themes.css` ile aynı.
  Sabit renk yalnızca prototipte de sabitse kullanılır (ör. avatar üstündeki `#0E0E10`).
- `components/ui/`: `Txt` (yazı), `Box` (zemin/çerçeve), `Press` (basınca küçülen buton),
  `Stagger` (sıralı belirme), `Sheet` (telefonda alttan panel, geniş ekranda pencere), `Icon`, `Avatar`.
  Bunlar tema değişince renkleri yumuşakça geçirir; düz `View`/`Text` yerine bunları kullan.
- Animasyonlar `theme/motion.ts` içindeki `useMotion()` ile: süre ve eğriler prototipteki CSS'ten.
  Hareketi azalt açıksa hepsi kendiliğinden kapanır.
- Yeni sayfa `components/layout/Screen` ile sarılır; telefonda üst çubuk, bilgisayarda başlık şeridi oradan gelir.
- Menü yolları `components/layout/nav.ts` içinde; yeni gizli sayfa eklenirse `HIDDEN_ROUTES`'a da yazılır.
  Telefondaki alt menü 6 sekmedir (`PHONE_TABS`); Fikirler orada yok, Akış'taki "Fikirler" butonundan açılır.

## Veri

- Bütün okuma/yazma `lib/queries.ts` içinde. Ekranlar Supabase'i doğrudan çağırmaz.
- `lib/useQuery.ts` küçük bir önbellek: aynı anahtar (`'tasks'`, `'feed'`...) ekranlar arasında paylaşılır.
  Bir yazma işleminden sonra `invalidate('tasks')` ile ilgili ekranlar yenilenir; kalp gibi anlık
  işlerde `mutateCache` ile önce ekran güncellenir.
- `lib/team.ts` → `useTeam()`: kişiler, projeler, istekler ve bunlardan türeyen yardımcılar
  (`canClaim`, `lockHint`, `pendingFor`...). Kilit kuralı veritabanındaki `claim_task` ile aynı tutulur.
- Görev alma, bitirme, istek ve paylaşım panelleri `components/sheets/ActionsProvider.tsx` içinde;
  ekranlar `useActions()` ile çağırır.
- Yüklenirken `SkeletonCards`, hata olursa `ErrorState` (`components/ui/Feedback.tsx`) gösterilir.
  Hata metinleri `lib/errors.ts` → `friendlyError` ile Türkçeye çevrilir.

## Sohbet (`components/chat/`, `lib/chat.ts`)

- Oda listesi `chat_overview()` ile gelir (son mesaj + okunmamış noktası). Mesajlar `messages:<oda id>`
  anahtarında; `NotificationsLive` içindeki Realtime kanalı yeni mesajda ilgili anahtarı yeniler.
- Mesaja telefonda uzun basınca, bilgisayarda tıklayınca işlem paneli açılır (`MessageActions`):
  yanıtla, kalp, göreve çevir (`openAddTask` taslakla), panoya not, düzenle, sil.
- Ses kaydı sadece telefonda (`expo-audio`, basılı tut / bırak). Görsel ve ses `chat-files` kovasında.
- Anma `@kullanıcıadı` ile; bildirimi veritabanı tetikleyicisi yazar (sadece odadaki kişilere).
- Sessiz saatler profilde; push fonksiyonu (`supabase/functions/push`) bu saatlerde sohbet bildirimini göndermez.

## Oylama (`components/feed/PollView.tsx`, `PollForm.tsx`, `lib/polls.ts`)

- Oylama `type = 'oylama'` olan bir posttur; `create_poll()` ile tek seferde açılır (doğrudan post açılamaz).
- Sonuç `poll_results()` ile, post başına `polls:<post id>` anahtarında. Sonuç görünmüyorsa `votes` null gelir.

## Panolar (`components/board/`)

- `Canvas.tsx`: bütün dokunuşlar tek bir `useManualGesture` içinde; neye basıldığı (bağlantı tutamacı,
  bağlama noktası, bölge köşesi, kart, bağlantı, boşluk) dünya koordinatından bulunur. Karta basıp
  kıpırdamadan bırakmak hareketi başlatmaz; kart içi düğmeler bu yüzden normal çalışır (`CardButton`).
- Sürükleme, kamera, eğme, boyutlandırma Reanimated paylaşılan değerlerinde (`live.ts`); React sadece
  parmak kalkınca güncellenir. React Compiler yüzünden `.value` yerine `.get()` / `.set()` kullanılır.
- Webde Reanimated SVG özelliklerini (path `d` vb.) güncelleyemiyor. Bu yüzden bağlantılar ve iz,
  canlı değerlerin `useAnimatedReaction` ile alınan kopyasıyla JS'te çizilir (`Links.tsx`, `Trail.tsx`).
  Kart konumu gibi stil değerleri `useAnimatedStyle` ile sorunsuz çalışır.
- Geometri (`geometry.ts`) prototipteki `geom`/`edge`/ok başı/iz zarfı ile birebir aynı.

## Sürüm

- Sürüm tek yerde: `app.json` → `expo.version` (`package.json` aynı tutulur); kodda `lib/version.ts` → `APP_VERSION`.
- Her aşamada sürüm yükseltilir: yeni özellik 0.x.0, sadece düzeltme 0.x.y. Maddeler `CHANGELOG.md`'ye yazılır,
  düzeltmeler "Düzeltmeler" başlığı altına.
- `npm run changelog` CHANGELOG'dan `lib/changelog.ts`'i üretir (web derlemesinden önce kendiliğinden çalışır).
  Yeni sürüme ilk açılışta "Neler yeni" paneli (`components/layout/WhatsNew.tsx`) bu dosyadaki o sürümü gösterir.

## Kurallar

- `android/` klasörü elle yazılmaz; yerel ayarlar `app.json` ve config plugin'lerle yapılır.
- Yetki kuralları istemcide değil veritabanında (RLS ve Postgres fonksiyonları) uygulanır.
  Örneğin görev alma yalnızca `claim_task` fonksiyonu üzerinden olur.
- Veri yüklenirken iskelet gösterilir, hatalar Türkçe ve sakin bir dille anlatılır.
- "Hareketi azalt" açıksa animasyonlar kapanır.

## Masaüstü (ABN Launcher)

- Tauri 2, `src-tauri/`. Arayüz Expo web çıktısı (`npm run build:desktop` → `dist/`). Bilgisayarda Rust yok; derleme GitHub Actions'ta (`.github/workflows/desktop.yml`, `v*` etiketiyle).
- Masaüstüne özel her şey `lib/desktop.ts` → `isDesktop` arkasında; Tauri modülleri sadece dinamik import ile yüklenir (web ve telefon etkilenmez).
- Sürümler ayrı: Merkez `app.json`, Launcher `src-tauri/tauri.conf.json` + `Cargo.toml`. Launcher sürümü `npm run release 1.0.1` ile çıkar (CHANGELOG'a `## Launcher x.y.z` bölümü ekler, commit + etiket + push).
- Animasyonların tek kaynağı `design/abn-animasyonlar.html`; değerler oradan birebir alınır.
- Güncelleme imza anahtarı projede değil: `%USERPROFILE%\.tauri\abn-launcher.key` (GitHub Secret `TAURI_SIGNING_PRIVATE_KEY`).
