# Değişiklik günlüğü

ABN Merkez'in sürümleri. Yeni özellik getiren sürüm 0.x.0, sadece düzeltme getiren sürüm 0.x.y olur.
Uygulama yeni bir sürüme ilk açıldığında "Neler yeni" panelinde o sürümün maddeleri gösterilir
(`npm run changelog` bu dosyadan `lib/changelog.ts`'i üretir).

## 0.11.1 · 13 Kasım 2026

### Düzeltmeler

- Dosya önizlemesi, bug detay paneli, Yeni build penceresi, Kanban'da sürüklenen kart ve sohbet menüsü ince bir şeride sıkışıyordu; artık pencerenin üstünde açılıyor.
- Bilgisayarda Wiki'nin Düzenle / Yeni sayfa, Buglar'ın Yeni build / Bug bildir butonları görünmüyordu.
- Sohbette mesaj araç çubuğu dar mesajlarda dışarı taşıyordu.
- Dosyalar'da yükleyen kişi "Biri" görünüyordu ve kendi dosyanı silemiyordun.
- Sohbet daha hızlı: görev, fikir ya da bug değişince bütün mesajlar yeniden çizilmiyor.

## Launcher 1.15.0 · 13 Kasım 2026

### Yeni

- Merkez 0.11.0: CHANGELOG, sürüm

## 0.11.0 · 13 Kasım 2026

### Yeni

- Ctrl+K (Mac'te Cmd+K) her ekrandan açılan komut paleti: işlemler, sayfalar, görevler, buglar, kişiler, wiki ve dosyalar arasında arama. Türkçe harflere duyarsız ("kapi" yazınca "kapı" bulunur), ↑↓ ile seç, Enter ile aç. Sonuç yoksa o adla görev oluşturur. Yan menünün en üstünde "Ara… Ctrl K" kutusu.
- Görevler'de Kanban / Liste geçişi (seçim hatırlanır). Kartlar sütunlar arasında ve sütun içinde sürükle bırakla taşınır, sıra kaydedilir; bırakınca kart yaylanarak oturur, "Bitti"ye bırakınca kutlama bildirimi. Her sütunun başında "+" ile o sütuna görev ekleme. Telefonda basılı tutup sürükle.
- Sohbette mesajın üstüne gelince araç çubuğu (😊 ↩ ☑ ⋯); sağ tık ya da ⋯ menüsünde Göreve çevir (T), Fikre çevir (F), Bug olarak bildir (B), Metni kopyala. Dönüşümden sonra mesajın altında herkesin gördüğü bağlantı çipi; sohbetten gelen görev kartında "💬 sohbetten · kişi".
- Wiki: sayfa ağacı (sürükleyip sıralama ve taşıma), yerinde düzenleme (başlık, liste, kalın / italik, görsel, renk kutucukları, bilgi kutusu), sayfa geçmişi ve geri yükleme. Aynı anda başkası düzenliyorsa uyarı; kimsenin yazdığı silinmez.
- Dosyalar: sohbet, pano, wiki ve buglara yüklenen bütün dosyalar tek yerde. Arama, tür filtreleri, önizleme (görsel, ses, video), "Kaynağa git", indirme; yükleyen ya da yönetici silebilir.
- Buglar: "Çıkışa hazır mı?" kartı, Yeni / Atandı / Düzeltildi / Test et / Kapandı sütunları, önem renkleri, sağdan açılan detay paneli (adımlar, ekran görüntüsü, geçmiş, duruma göre butonlar). Bug numaraları proje başına (B-1, B-2…), yeni build kaydı, atanınca / test istenince / yeniden açılınca bildirim. Açık kritik bug sayısı yan menüde kırmızı rozet.
- Launcher'dan açılan oyunda F8: ekran görüntüsü, oyunun sürümü ve bilgisayar bilgisiyle küçük "Ne oldu?" penceresi. Tuş Launcher Ayarlar'dan değiştirilebilir.

## Launcher 1.14.1 · 13 Kasım 2026

### Yeni

- CI: package-lock npm 10 ile yeniden üretildi (Missing @floating-ui/dom)

## Launcher 1.14.0 · 13 Kasım 2026

### Yeni

- Launcher: oyun içinden F8 ile bug bildirme (ekran görüntüsü, build, bilgisayar bilgisi), kısayol ayarı

## Launcher 1.13.0 · 13 Kasım 2026

### Yeni

- 0.11 bölüm 6: bug takibi (buglar, buildler, detay paneli, bug formu, bildirimler)

## Launcher 1.12.0 · 13 Kasım 2026

### Yeni

- 0.11 bölüm 5: Dosyalar (tek liste, önizleme, kaynağıyla silme)

## Launcher 1.11.0 · 13 Kasım 2026

### Yeni

- 0.11 bölüm 4: Wiki (sayfa ağacı, TipTap, geçmiş, çakışma koruması)

## Launcher 1.10.0 · 13 Kasım 2026

### Yeni

- 0.11 bölüm 3: mesajı göreve / fikre çevirme, bağlantı çipleri

## Launcher 1.9.0 · 13 Kasım 2026

### Yeni

- 0.11 bölüm 2: Kanban sürükle bırak, Liste görünümü, görev sırası

## Launcher 1.8.0 · 13 Kasım 2026

### Yeni

- 0.11 bölüm 1: Ctrl+K komut paleti

## Launcher 1.7.0 · 10 Kasım 2026

### Yeni

- Merkez 0.10.0: eski profil sayfası kaldırıldı, profil penceresine yönleniyor

## 0.10.0 · 10 Kasım 2026

### Yeni

- Discord tarzı profil: mini kart, tam profil penceresi, canlı önizlemeli düzenleme, durumlar.
- Sol alttaki kartına tıklayınca mini profil açılır: durum (Müsait, Meşgul, Uzakta, Görünmez), süreli özel durum, Profili düzenle, Tam profili aç.
- Sohbette, ekipte, görevlerde ve bildirimlerde bir avatara ya da isme tıklayınca tam profil penceresi açılır: Hakkında, Görevler ve Etkinlik sekmeleri, Mesaj gönder.
- Profili düzenle: avatar ve banner görseli (kırparak), serbest renkler, vurgu rengi, zamirler, çalışma saatleri, 300 karakterlik hakkında. Kaydetmeden kapatmaya çalışınca uyarır.
- Profil değişiklikleri herkeste sayfa yenilenmeden görünür. Meşgul'deyken masaüstü bildirimleri susar; Görünmez olan kişi gri halkayla görünür.
- Şifre değiştirme ve çıkış artık Profili düzenle > Hesap'ta.

## Launcher 1.6.0 · 10 Kasım 2026

### Yeni

- Profil bölüm 4: canlı profil güncellemesi, durum noktaları, Meşgul'de sessiz bildirim

## Launcher 1.5.0 · 10 Kasım 2026

### Yeni

- Profil bölüm 3: profili düzenle penceresi, kırpma ve webp yükleme

## Launcher 1.4.0 · 10 Kasım 2026

### Yeni

- Profil bölüm 2: tam profil penceresi

## Launcher 1.3.1 · 10 Kasım 2026

### Yeni

- Mini profil kartı ana içeriğin arkasında kalıyordu

## Launcher 1.3.0 · 10 Kasım 2026

### Yeni

- Profil bölüm 1: mini profil kartı, durum ve özel durum

## Launcher 1.2.0 · 9 Kasım 2026

### Yeni

- Merkez 0.9.0 masaüstünde: panoda köşeden boyutlandırma, Ctrl/Shift ile çoklu seçim ve Delete ile silme (5 sn içinde geri alınabilir).

## 0.9.0 · 9 Kasım 2026

### Yeni

- Panoda fotoğraf, video ve not kartları köşelerinden büyütülüp küçültülebiliyor. Fotoğraf ve videoda oran korunuyor (Shift ile serbest); boyutlandırırken ölçü görünüyor.
- Ctrl ya da Shift ile tıklayarak birden fazla kart seçip birlikte taşıyabilirsin.
- Seçili kartlar Delete / Backspace ya da sağ tık > Sil ile siliniyor; 5 sn içinde "Geri al" ya da Ctrl+Z ile geri gelir.

## Launcher 1.1.0 · 9 Kasım 2026

### Yeni

- Masaüstü bildirimleri: özel tasarım, yanıtlama, 7 bildirim sesi.
- Kartlar temanın renkleri ve ışığıyla geliyor; üzerine gelince süre duruyor, Yanıtla / Okundu / Sessize al (1 saat, 8 saat, bu sohbeti) çıkıyor. Karttan yazıp Enter'la yanıt gönderebilirsin; sağa sürükleyince kapanır.
- Türler: mesaj, @anma (şeritli, ayrı ses), kalp (kapsül), görev ve isteğe cevap, duyuru (kapatana kadar kalır), oylama sonucu.
- Aynı anda en fazla 3 kart; fazlası "+N bildirim daha". Aynı sohbetten 10 sn içinde gelen mesajlar tek kartta toplanır.
- Ayarlar > Bildirimler: konum, süre (4/6/10 sn), önizleme, ses seçimi ("Dinle" ile), ses seviyesi, türlere göre aç/kapa ve "Deneme bildirimi gönder".
- Sessiz saatlerde kart ve ses gelmez.

## Launcher 1.0.5 · 9 Kasım 2026

### Yeni

- Merkez 0.8.0 masaüstünde: 9 yeni tema, 5'i gradyanlı.
- Kendi bildirim penceremiz (ilk adım): mesajlar, anmalar ve bildirimler ekranın sağ altında ABN'nin kartlarında görünüyor; Windows'un standart bildirimi kaldırıldı. Launcher ve Merkez kapalıyken de (tepsideyken) geliyor; açık olduğun sohbetten bildirim gelmiyor.

## Launcher 1.0.4 · 9 Kasım 2026

### Yeni

- Yeni mor simge: masaüstü kısayolu, görev çubuğu ve tepsi mor logolu koyu simgeyi kullanıyor; kurulum dosyasının köşesinde indirme işareti var.

## Launcher 1.0.3 · 9 Kasım 2026

### Düzeltmeler

- "Merkez'i aç" ya da "Giriş yap" deyince Merkez penceresi bembeyaz kalıyor ve kapanmıyordu; düzeltildi.

## Launcher 1.0.0 · 9 Kasım 2026

### Yeni

- ABN Launcher: ABN Merkez masaüstünde, ayrı bir pencerede. Kapatınca tepsiye iner, Windows açılışında sessizce başlayabilir.
- Açılış penceresi: eski televizyon gibi açılıyor, logo çiziliyor; o sırada güncelleme denetleniyor ve gerekiyorsa iniyor.
- Ana sayfa: Merkez kartı (aç, güncelle, öne getir), oyun kartları ve sağda haberler (sabit duyuru, son güncellemeler, pano hareketleri, oyun sürümleri).
- Oyunlar: indir, duraklat, kaldığı yerden sürdür, doğrula, kaldır, oyna. Oyun açıkken launcher tepsiye iner, kapanınca geri gelir.
- Windows bildirimleri: yorum, kalp, duyuru, görev ataması ve anma; tıklayınca ilgili sayfa açılıyor. Sessiz saatlere ve tepsideki "Sessiz mod"a uyuyor.
- Ctrl+Shift+Space ile her yerden hızlı fikir: Enter kaydeder, Fikir Defteri'ne düşer.
- Kendini otomatik güncelliyor; yeni sürümler GitHub'dan geliyor.

## 0.8.0 · 10 Kasım 2026

### Yeni

- Temalar yenilendi: 9 tema, 5'i gradyanlı (üstten ışık ve kart gradyanları)
- Koyu: Okyanus, Kor, Gece Yarısı, Noir Işık, Noir. Açık: Nane, Zeytin, Adaçayı, Pudra.
- Gradyanlı temalarda ekranın tepesinden yumuşak bir ışık yayılıyor; duyuru ve görev kartları, ana butonlar, seçili sekmeler gradyanlı.
- Tema seçicide her temanın kendi zemini ve ışığıyla küçük bir önizleme.
- Varsayılan tema sistem moduna göre: koyu modda Gece Yarısı, açık modda Nane. Kaldırılan temaları kullananlar en yakın yeni temaya geçti.
- Sabit duyuru kartı artık duyuru rengiyle (a2) gösteriliyor; görev kartında "Sende" küçük bir rozet.

## 0.7.0 · 5 Kasım 2026

### Yeni

- Sürüm takibi: sürüm numarası profilin en altında görünüyor, yeni sürüme ilk açılışta "Neler yeni" paneli çıkıyor.
- Temalar sadeleşti: ABN Koyu, Gece, ABN Açık ve Adaçayı. Seçicide küçük önizlemeli kartlar. Kaldırılan bir temayı kullananlar ABN Koyu'ya geçti.
- Yeni ABN logosu (vektör): uygulamada temaya uyan dairesel işaret; uygulama ikonu, favicon ve ana ekran ikonları da aynı logodan.
- Açılış animasyonu: logo çizilip doluyor, ekip toplanırken yükleme çubuğu ilerliyor. "Hareketi azalt" açıksa animasyonsuz.
- Yükleniyor işareti logodan: dış hatta renk değiştiren bir çizgi tur atıyor.
- İskelet yükleme parıltısı ve kartların sırayla yerine oturması.
- Paylaş, Gönder ve Kaydet butonları: gönderirken daralıp dönüyor, başarıda onay işaretiyle "Paylaşıldı" diyor.
- Kalp: pop, renkli kareler, telefonda hafif titreşim; avatarın yayla ekleniyor.
- Görev bitince kartta kutlama: onay kutusu, konfeti ve paylaşım daveti.
- Detay sayfaları sağdan kayarak açılıyor.
- Boş ekranlar: logonun parçaları yerde, biri ara ara yuvasına zıplıyor; her boş liste için kısa açıklama ve yol gösteren buton.
- Telefonda aşağı çekip yenile: logo çekildikçe çiziliyor, yeni gelen paylaşımlar kısa bir süre renkli giriyor.
- Panoya birden çok dosya yükleme: gerçek ilerleme, kalan süre, görselin alttan netleşmesi; hata olursa "Tekrar dene" kaldığı yerden devam ediyor.
- Bağlantı koptuğunda üstte nazik bir kapsül; o sırada yazılan mesaj ve paylaşımlar "Bekliyor" olarak kalıp bağlantı gelince gönderiliyor.
- Hoş geldin turu: ilk girişte kısa bir tanışma; ne yaptığın, vaktin, sessiz saatlerin, teman ve katılmak istediğin projeler. Hepsi isteğe bağlı, istediğin an "Atla". Profilinden tekrar açılabilir.
- Profilde "Ne yaparsın?" seçimlerin görünüyor.

### Düzeltmeler

- Soluk yazılar dört temada da okunur hale geldi: düşük kontrastlı yazı renkleri (açıklama, ipucu, vurgu) en az 4.5:1 olacak şekilde ayarlandı; en çok Adaçayı'da fark edilir.
- Küçük butonların (kapat, sil, araç çubuğu) dokunma alanı telefonda en az 44 piksel; görünüşleri değişmedi.
- Sohbet uzun konuşmalarda daha akıcı: sadece ekrandaki mesajlar çiziliyor. Yukarıda eski mesajları okurken yeni mesaj gelince sayfa yerinden oynamıyor; kendi mesajını gönderince en alta iniyor.
- Telefonda sohbet ekranının kenar boşlukları diğer ekranlarla aynı (20 piksel).
- Silinmiş ya da üyesi olmadığın bir sohbetin bağlantısı artık boş oda yerine "Bu sohbet bulunamadı" gösteriyor.
- Pano yüklenemezse "Tekrar dene" butonu çıkıyor.

## 0.6.0 · 2 Kasım 2026

### Yeni

- Yönetim paneli: genel bakış, istekler, üyeler, projeler, görev kilitleri ve duyurular.
- Bildirimler: yorum, kalp, istek, duyuru ve görev ataması için uygulama içi zil; Android'e push.
- Kullanıcı adı ve şifreyle giriş; üyeleri yöneticiler açar, herkes kendi şifresini değiştirebilir.
- Sohbet: genel oda, proje odaları ve özel mesajlar; yanıt, kalp, @ ile anma, görsel ve sesli mesaj.
- Oylama: akışta tek ya da çoklu seçimli, isimli ya da isimsiz oylama.
- Sessiz saatler: bu saatlerde sohbet bildirimi telefona gelmiyor.
- Abby's Nexus logosu uygulamada ve ikonlarda.
- Web'de yayın (Vercel) ve Android APK ayarları.

### Düzeltmeler

- Akış paylaşımları göstermiyordu; düzeltildi.
- Uzun sayfalar kaydırılamıyordu; düzeltildi.
- Panolarda fare tekerleği artık Ctrl'siz yakınlaştırıyor.

## 0.5.0 · 31 Ekim 2026

### Yeni

- Panolar: sonsuz tuval, not, yapılacaklar, görsel, renk, bağlantı, bölge, çizim, tablo ve dosya kartları.
- Kartlar arası bağlantılar, alt panolar ve canlı ortak düzenleme.

## 0.4.0 · 31 Ekim 2026

### Yeni

- Akış, Görevler, Projeler, Fikir Defteri, Ekip ve Profil ekranları.
- Görev alma, istek gönderme, "takıldım" ve haftalık özet.

## 0.3.0 · 30 Ekim 2026

### Yeni

- Giriş ekranı, temalar, telefonda alt menü ve bilgisayarda sol menü.

## 0.2.0 · 30 Ekim 2026

### Yeni

- Veritabanı, satır düzeyi güvenlik kuralları ve örnek veri.

## 0.1.0 · 30 Ekim 2026

### Yeni

- Proje kurulumu: Expo, Expo Router, TypeScript, Supabase.
