// Bu dosya scripts/changelog.mjs tarafından CHANGELOG.md'den üretilir. Elle düzenleme.

export type Release = { version: string; date: string; sections: { title: string; items: string[] }[] };

export const RELEASES: Release[] = [
  {
    "version": "0.10.0",
    "date": "10 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Discord tarzı profil: mini kart, tam profil penceresi, canlı önizlemeli düzenleme, durumlar.",
          "Sol alttaki kartına tıklayınca mini profil açılır: durum (Müsait, Meşgul, Uzakta, Görünmez), süreli özel durum, Profili düzenle, Tam profili aç.",
          "Sohbette, ekipte, görevlerde ve bildirimlerde bir avatara ya da isme tıklayınca tam profil penceresi açılır: Hakkında, Görevler ve Etkinlik sekmeleri, Mesaj gönder.",
          "Profili düzenle: avatar ve banner görseli (kırparak), serbest renkler, vurgu rengi, zamirler, çalışma saatleri, 300 karakterlik hakkında. Kaydetmeden kapatmaya çalışınca uyarır.",
          "Profil değişiklikleri herkeste sayfa yenilenmeden görünür. Meşgul'deyken masaüstü bildirimleri susar; Görünmez olan kişi gri halkayla görünür.",
          "Şifre değiştirme ve çıkış artık Profili düzenle > Hesap'ta."
        ]
      }
    ]
  },
  {
    "version": "0.9.0",
    "date": "9 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Panoda fotoğraf, video ve not kartları köşelerinden büyütülüp küçültülebiliyor. Fotoğraf ve videoda oran korunuyor (Shift ile serbest); boyutlandırırken ölçü görünüyor.",
          "Ctrl ya da Shift ile tıklayarak birden fazla kart seçip birlikte taşıyabilirsin.",
          "Seçili kartlar Delete / Backspace ya da sağ tık > Sil ile siliniyor; 5 sn içinde \"Geri al\" ya da Ctrl+Z ile geri gelir."
        ]
      }
    ]
  },
  {
    "version": "0.8.0",
    "date": "10 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Temalar yenilendi: 9 tema, 5'i gradyanlı (üstten ışık ve kart gradyanları)",
          "Koyu: Okyanus, Kor, Gece Yarısı, Noir Işık, Noir. Açık: Nane, Zeytin, Adaçayı, Pudra.",
          "Gradyanlı temalarda ekranın tepesinden yumuşak bir ışık yayılıyor; duyuru ve görev kartları, ana butonlar, seçili sekmeler gradyanlı.",
          "Tema seçicide her temanın kendi zemini ve ışığıyla küçük bir önizleme.",
          "Varsayılan tema sistem moduna göre: koyu modda Gece Yarısı, açık modda Nane. Kaldırılan temaları kullananlar en yakın yeni temaya geçti.",
          "Sabit duyuru kartı artık duyuru rengiyle (a2) gösteriliyor; görev kartında \"Sende\" küçük bir rozet."
        ]
      }
    ]
  },
  {
    "version": "0.7.0",
    "date": "5 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Sürüm takibi: sürüm numarası profilin en altında görünüyor, yeni sürüme ilk açılışta \"Neler yeni\" paneli çıkıyor.",
          "Temalar sadeleşti: ABN Koyu, Gece, ABN Açık ve Adaçayı. Seçicide küçük önizlemeli kartlar. Kaldırılan bir temayı kullananlar ABN Koyu'ya geçti.",
          "Yeni ABN logosu (vektör): uygulamada temaya uyan dairesel işaret; uygulama ikonu, favicon ve ana ekran ikonları da aynı logodan.",
          "Açılış animasyonu: logo çizilip doluyor, ekip toplanırken yükleme çubuğu ilerliyor. \"Hareketi azalt\" açıksa animasyonsuz.",
          "Yükleniyor işareti logodan: dış hatta renk değiştiren bir çizgi tur atıyor.",
          "İskelet yükleme parıltısı ve kartların sırayla yerine oturması.",
          "Paylaş, Gönder ve Kaydet butonları: gönderirken daralıp dönüyor, başarıda onay işaretiyle \"Paylaşıldı\" diyor.",
          "Kalp: pop, renkli kareler, telefonda hafif titreşim; avatarın yayla ekleniyor.",
          "Görev bitince kartta kutlama: onay kutusu, konfeti ve paylaşım daveti.",
          "Detay sayfaları sağdan kayarak açılıyor.",
          "Boş ekranlar: logonun parçaları yerde, biri ara ara yuvasına zıplıyor; her boş liste için kısa açıklama ve yol gösteren buton.",
          "Telefonda aşağı çekip yenile: logo çekildikçe çiziliyor, yeni gelen paylaşımlar kısa bir süre renkli giriyor.",
          "Panoya birden çok dosya yükleme: gerçek ilerleme, kalan süre, görselin alttan netleşmesi; hata olursa \"Tekrar dene\" kaldığı yerden devam ediyor.",
          "Bağlantı koptuğunda üstte nazik bir kapsül; o sırada yazılan mesaj ve paylaşımlar \"Bekliyor\" olarak kalıp bağlantı gelince gönderiliyor.",
          "Hoş geldin turu: ilk girişte kısa bir tanışma; ne yaptığın, vaktin, sessiz saatlerin, teman ve katılmak istediğin projeler. Hepsi isteğe bağlı, istediğin an \"Atla\". Profilinden tekrar açılabilir.",
          "Profilde \"Ne yaparsın?\" seçimlerin görünüyor."
        ]
      },
      {
        "title": "Düzeltmeler",
        "items": [
          "Soluk yazılar dört temada da okunur hale geldi: düşük kontrastlı yazı renkleri (açıklama, ipucu, vurgu) en az 4.5:1 olacak şekilde ayarlandı; en çok Adaçayı'da fark edilir.",
          "Küçük butonların (kapat, sil, araç çubuğu) dokunma alanı telefonda en az 44 piksel; görünüşleri değişmedi.",
          "Sohbet uzun konuşmalarda daha akıcı: sadece ekrandaki mesajlar çiziliyor. Yukarıda eski mesajları okurken yeni mesaj gelince sayfa yerinden oynamıyor; kendi mesajını gönderince en alta iniyor.",
          "Telefonda sohbet ekranının kenar boşlukları diğer ekranlarla aynı (20 piksel).",
          "Silinmiş ya da üyesi olmadığın bir sohbetin bağlantısı artık boş oda yerine \"Bu sohbet bulunamadı\" gösteriyor.",
          "Pano yüklenemezse \"Tekrar dene\" butonu çıkıyor."
        ]
      }
    ]
  },
  {
    "version": "0.6.0",
    "date": "2 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Yönetim paneli: genel bakış, istekler, üyeler, projeler, görev kilitleri ve duyurular.",
          "Bildirimler: yorum, kalp, istek, duyuru ve görev ataması için uygulama içi zil; Android'e push.",
          "Kullanıcı adı ve şifreyle giriş; üyeleri yöneticiler açar, herkes kendi şifresini değiştirebilir.",
          "Sohbet: genel oda, proje odaları ve özel mesajlar; yanıt, kalp, @ ile anma, görsel ve sesli mesaj.",
          "Oylama: akışta tek ya da çoklu seçimli, isimli ya da isimsiz oylama.",
          "Sessiz saatler: bu saatlerde sohbet bildirimi telefona gelmiyor.",
          "Abby's Nexus logosu uygulamada ve ikonlarda.",
          "Web'de yayın (Vercel) ve Android APK ayarları."
        ]
      },
      {
        "title": "Düzeltmeler",
        "items": [
          "Akış paylaşımları göstermiyordu; düzeltildi.",
          "Uzun sayfalar kaydırılamıyordu; düzeltildi.",
          "Panolarda fare tekerleği artık Ctrl'siz yakınlaştırıyor."
        ]
      }
    ]
  },
  {
    "version": "0.5.0",
    "date": "31 Ekim 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Panolar: sonsuz tuval, not, yapılacaklar, görsel, renk, bağlantı, bölge, çizim, tablo ve dosya kartları.",
          "Kartlar arası bağlantılar, alt panolar ve canlı ortak düzenleme."
        ]
      }
    ]
  },
  {
    "version": "0.4.0",
    "date": "31 Ekim 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Akış, Görevler, Projeler, Fikir Defteri, Ekip ve Profil ekranları.",
          "Görev alma, istek gönderme, \"takıldım\" ve haftalık özet."
        ]
      }
    ]
  },
  {
    "version": "0.3.0",
    "date": "30 Ekim 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Giriş ekranı, temalar, telefonda alt menü ve bilgisayarda sol menü."
        ]
      }
    ]
  },
  {
    "version": "0.2.0",
    "date": "30 Ekim 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Veritabanı, satır düzeyi güvenlik kuralları ve örnek veri."
        ]
      }
    ]
  },
  {
    "version": "0.1.0",
    "date": "30 Ekim 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Proje kurulumu: Expo, Expo Router, TypeScript, Supabase."
        ]
      }
    ]
  }
];

/** ABN Launcher (masaüstü) sürümleri. */
export const LAUNCHER_RELEASES: Release[] = [
  {
    "version": "1.6.0",
    "date": "10 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Profil bölüm 4: canlı profil güncellemesi, durum noktaları, Meşgul'de sessiz bildirim"
        ]
      }
    ]
  },
  {
    "version": "1.5.0",
    "date": "10 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Profil bölüm 3: profili düzenle penceresi, kırpma ve webp yükleme"
        ]
      }
    ]
  },
  {
    "version": "1.4.0",
    "date": "10 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Profil bölüm 2: tam profil penceresi"
        ]
      }
    ]
  },
  {
    "version": "1.3.1",
    "date": "10 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Mini profil kartı ana içeriğin arkasında kalıyordu"
        ]
      }
    ]
  },
  {
    "version": "1.3.0",
    "date": "10 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Profil bölüm 1: mini profil kartı, durum ve özel durum"
        ]
      }
    ]
  },
  {
    "version": "1.2.0",
    "date": "9 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Merkez 0.9.0 masaüstünde: panoda köşeden boyutlandırma, Ctrl/Shift ile çoklu seçim ve Delete ile silme (5 sn içinde geri alınabilir)."
        ]
      }
    ]
  },
  {
    "version": "1.1.0",
    "date": "9 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Masaüstü bildirimleri: özel tasarım, yanıtlama, 7 bildirim sesi.",
          "Kartlar temanın renkleri ve ışığıyla geliyor; üzerine gelince süre duruyor, Yanıtla / Okundu / Sessize al (1 saat, 8 saat, bu sohbeti) çıkıyor. Karttan yazıp Enter'la yanıt gönderebilirsin; sağa sürükleyince kapanır.",
          "Türler: mesaj, @anma (şeritli, ayrı ses), kalp (kapsül), görev ve isteğe cevap, duyuru (kapatana kadar kalır), oylama sonucu.",
          "Aynı anda en fazla 3 kart; fazlası \"+N bildirim daha\". Aynı sohbetten 10 sn içinde gelen mesajlar tek kartta toplanır.",
          "Ayarlar > Bildirimler: konum, süre (4/6/10 sn), önizleme, ses seçimi (\"Dinle\" ile), ses seviyesi, türlere göre aç/kapa ve \"Deneme bildirimi gönder\".",
          "Sessiz saatlerde kart ve ses gelmez."
        ]
      }
    ]
  },
  {
    "version": "1.0.5",
    "date": "9 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Merkez 0.8.0 masaüstünde: 9 yeni tema, 5'i gradyanlı.",
          "Kendi bildirim penceremiz (ilk adım): mesajlar, anmalar ve bildirimler ekranın sağ altında ABN'nin kartlarında görünüyor; Windows'un standart bildirimi kaldırıldı. Launcher ve Merkez kapalıyken de (tepsideyken) geliyor; açık olduğun sohbetten bildirim gelmiyor."
        ]
      }
    ]
  },
  {
    "version": "1.0.4",
    "date": "9 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "Yeni mor simge: masaüstü kısayolu, görev çubuğu ve tepsi mor logolu koyu simgeyi kullanıyor; kurulum dosyasının köşesinde indirme işareti var."
        ]
      }
    ]
  },
  {
    "version": "1.0.3",
    "date": "9 Kasım 2026",
    "sections": [
      {
        "title": "Düzeltmeler",
        "items": [
          "\"Merkez'i aç\" ya da \"Giriş yap\" deyince Merkez penceresi bembeyaz kalıyor ve kapanmıyordu; düzeltildi."
        ]
      }
    ]
  },
  {
    "version": "1.0.0",
    "date": "9 Kasım 2026",
    "sections": [
      {
        "title": "Yeni",
        "items": [
          "ABN Launcher: ABN Merkez masaüstünde, ayrı bir pencerede. Kapatınca tepsiye iner, Windows açılışında sessizce başlayabilir.",
          "Açılış penceresi: eski televizyon gibi açılıyor, logo çiziliyor; o sırada güncelleme denetleniyor ve gerekiyorsa iniyor.",
          "Ana sayfa: Merkez kartı (aç, güncelle, öne getir), oyun kartları ve sağda haberler (sabit duyuru, son güncellemeler, pano hareketleri, oyun sürümleri).",
          "Oyunlar: indir, duraklat, kaldığı yerden sürdür, doğrula, kaldır, oyna. Oyun açıkken launcher tepsiye iner, kapanınca geri gelir.",
          "Windows bildirimleri: yorum, kalp, duyuru, görev ataması ve anma; tıklayınca ilgili sayfa açılıyor. Sessiz saatlere ve tepsideki \"Sessiz mod\"a uyuyor.",
          "Ctrl+Shift+Space ile her yerden hızlı fikir: Enter kaydeder, Fikir Defteri'ne düşer.",
          "Kendini otomatik güncelliyor; yeni sürümler GitHub'dan geliyor."
        ]
      }
    ]
  }
];
