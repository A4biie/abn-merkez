-- ABN Merkez · örnek veri (prototype/*.html içindeki SEED ve state verileri)
-- Migration'lardan sonra, boş bir veritabanında bir kez çalıştırılır.
--
-- Kimlikler okunabilir olsun diye md5('abn:<tür>:<prototip id>')::uuid ile üretilir;
-- böylece prototipteki 't1', 'pn4' gibi adlar SQL'de de görünür.
--
-- Beş örnek kişi oluşur. Kullanıcı adları ruzgar, ece, mert, deniz, selin; şifreleri yoktur,
-- yönetici belirleyene kadar giriş yapamazlar. Kendi hesabını Rüzgar'a bağlamak için en alttaki notlara bak.

begin;

-- ───────────────────────── Kişiler ─────────────────────────
-- auth.users'a eklenince handle_new_user tetikleyicisi profili açar.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', md5('abn:user:' || k)::uuid, 'authenticated', 'authenticated',
  k || '@abnmerkez.local', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', n), now() - (o || ' minutes')::interval, now(),
  '', '', '', ''
from (values ('ruzgar', 'Rüzgar', 5), ('ece', 'Ece', 4), ('mert', 'Mert', 3),
             ('deniz', 'Deniz', 2), ('selin', 'Selin', 1)) as v(k, n, o)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now()
from auth.users u
where u.email like '%@abnmerkez.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

update public.profiles p set
  full_name = v.name, role_title = v.role, is_admin = v.adm, avatar_color = v.color,
  availability = v.avail, availability_until = v.until, banner_color = v.banner,
  bio = v.bio, links = v.links::jsonb
from (values
  ('ruzgar', 'Rüzgar', 'ABN Temsilcisi', true, '#E4F68F', 'musait', null::date, 'gece',
   'Abby’s Nexus’u kurdum. Oyunlar, sinema ve iyi hikâyeler peşindeyim.', '[]'),
  ('ece', 'Ece', 'Çizer', false, '#C5B5FA', 'musait', null, 'lilac',
   'Karakter tasarımı ve konsept çizim. PaleMouth’un yüzlerini ben çiziyorum.',
   '[{"label":"ArtStation","url":"artstation.com/ornek-ece"},{"label":"Instagram","url":"instagram.com/ornek.ece"}]'),
  ('mert', 'Mert', 'Çizer', false, '#8EE8F5', 'yogun', null, 'cyan',
   'Logo, arayüz ve piksel işleri. Game jam fikri benden.',
   '[{"label":"Behance","url":"behance.net/ornek-mert"}]'),
  ('deniz', 'Deniz', 'Video editörü', false, '#F5C77E', 'ara', date '2027-01-15', 'lime',
   'Kurgu, ses ve fragman. Sınavlar bitince geri döneceğim.', '[]'),
  ('selin', 'Selin', 'Yazar', false, '#F2A7C3', 'musait', null, 'lime',
   'Dedektif Antolojisi’nin yazarıyım. Polisiye, eski İstanbul ve sıcak çay.',
   '[{"label":"Medium","url":"medium.com/@ornek-selin"}]')
) as v(k, name, role, adm, color, avail, until, banner, bio, links)
where p.id = md5('abn:user:' || v.k)::uuid;

update public.profit_shares s set rate = v.rate
from (values ('ece', 5.0), ('mert', 5.0)) as v(k, rate)
where s.user_id = md5('abn:user:' || v.k)::uuid;

-- ───────────────────────── Projeler ─────────────────────────

insert into public.projects (id, slug, name, summary, status, lead_id) values
  (md5('abn:project:palemouth')::uuid, 'palemouth', 'PaleMouth',
   'Türkçe psikolojik korku visual novel.', 'gelistirmede', md5('abn:user:ruzgar')::uuid),
  (md5('abn:project:dedektif')::uuid, 'dedektif', 'Dedektif Antolojisi',
   'Her hikâyede ayrı bir dedektif, ortak mekanikler.', 'fikir', md5('abn:user:ruzgar')::uuid),
  (md5('abn:project:gumruk')::uuid, 'gumruk', 'Gümrük Oyunu',
   'Hikâye odaklı gümrük memuru simülatörü.', 'rafta', md5('abn:user:ruzgar')::uuid)
on conflict (id) do nothing;

insert into public.project_members (project_id, user_id)
select md5('abn:project:' || p)::uuid, md5('abn:user:' || u)::uuid
from (values ('palemouth', 'ruzgar'), ('palemouth', 'ece'), ('palemouth', 'mert'), ('palemouth', 'deniz'),
             ('dedektif', 'ruzgar'), ('dedektif', 'selin'),
             ('gumruk', 'ruzgar')) as v(p, u)
on conflict do nothing;

insert into public.milestones (project_id, title, done, position)
select md5('abn:project:' || p)::uuid, t, d, pos
from (values
  ('palemouth', 'Hikâye taslağı', true, 1), ('palemouth', 'Karakter tasarımları', true, 2),
  ('palemouth', 'Demo', false, 3), ('palemouth', '1. Bölüm', false, 4), ('palemouth', 'Steam sayfası', false, 5),
  ('dedektif', 'Konsept', true, 1), ('dedektif', 'İlk dedektif hikâyesi', false, 2),
  ('dedektif', 'Sorgu mekaniği prototipi', false, 3),
  ('gumruk', 'Konsept', true, 1), ('gumruk', 'Prototip', false, 2), ('gumruk', 'Hikâye örgüsü', false, 3),
  ('gumruk', 'Demo', false, 4)
) as v(p, t, d, pos);

-- ───────────────────────── Görevler ─────────────────────────
-- Prototip durumları: yapilacak → havuz, devam → bende, inceleme → incelemede.

insert into public.tasks (id, title, project_id, status, assignee_id, due_label, needs_help,
                          lock_type, lock_roles, created_by, status_changed_at)
select md5('abn:task:' || v.k)::uuid, v.title,
       case when v.p is null then null else md5('abn:project:' || v.p)::uuid end,
       v.status,
       case when v.a is null then null else md5('abn:user:' || v.a)::uuid end,
       v.due, v.help, v.lock, v.roles, md5('abn:user:ruzgar')::uuid,
       now() - (v.idle || ' days')::interval
from (values
  ('t1',  'Ana karakter yüz ifadeleri',       'palemouth', 'bende',      'ece',   'Bu hafta',    false, 'yok',   '{}'::text[], 1),
  ('t2',  '2. sahne arka planı',              'palemouth', 'havuz',      null,    'Bu ay',       false, 'yok',   '{}',  3),
  ('t3',  'Demo fragman kurgusu',             'palemouth', 'bende',      'deniz', 'Bu ay',       true,  'yok',   '{}',  2),
  ('t4',  'Dedektif Michael hikâye taslağı',  'dedektif',  'bende',      'selin', 'Bu ay',       false, 'yok',   '{}',  1),
  ('t5',  'Sorgu mekaniği notları',           'dedektif',  'havuz',      null,    'Acelesi yok', false, 'yok',   '{}',  2),
  ('t6',  'ABN Instagram kapak görseli',      null,        'havuz',      null,    'Bu hafta',    false, 'rol',   '{Çizer}', 1),
  ('t7',  'Ekip tanıtım videosu metni',       null,        'havuz',      null,    'Bu ay',       false, 'yok',   '{}',  4),
  ('t8',  'Jessica karakter fikri',           'dedektif',  'incelemede', 'selin', '20 Ekim',     false, 'yok',   '{}',  21),
  ('t9',  'Kapı gıcırtısı ses efekti',        'palemouth', 'bitti',      'deniz', 'Bu hafta',    false, 'yok',   '{}',  2),
  ('t10', 'Konsept dokümanı',                 'dedektif',  'bitti',      'selin', 'Bu hafta',    false, 'yok',   '{}',  3),
  ('t11', 'PaleMouth logo taslakları',        'palemouth', 'bitti',      'mert',  'Bu hafta',    false, 'yok',   '{}',  2),
  ('t12', 'ABN web sitesi metinleri',         null,        'havuz',      null,    'Acelesi yok', false, 'admin', '{}',  5)
) as v(k, title, p, status, a, due, help, lock, roles, idle)
on conflict (id) do nothing;

-- ───────────────────────── İstekler ─────────────────────────

insert into public.requests (kind, requester_id, project_id, task_id, status, decided_by, decided_at, created_at) values
  ('proje', md5('abn:user:mert')::uuid,  md5('abn:project:dedektif')::uuid, null, 'bekliyor', null, null, now() - interval '5 hours'),
  ('gorev', md5('abn:user:selin')::uuid, null, md5('abn:task:t12')::uuid,   'bekliyor', null, null, now() - interval '3 hours'),
  ('proje', md5('abn:user:deniz')::uuid, md5('abn:project:dedektif')::uuid, null, 'reddedildi',
   md5('abn:user:ruzgar')::uuid, now() - interval '2 days', now() - interval '4 days');

-- ───────────────────────── Akış ─────────────────────────
-- media içindeki {"type":"ornek","art":...} prototipteki çizim yer tutucularıdır.

insert into public.posts (id, author_id, type, body, project_id, task_id, media, created_at) values
  (md5('abn:post:p1')::uuid, md5('abn:user:ece')::uuid, 'fikrinizi_istiyorum',
   'Yüz ifadelerinin ilk turu. Korku sahnesindekini biraz abarttım, sizce fazla mı?',
   md5('abn:project:palemouth')::uuid, md5('abn:task:t1')::uuid,
   '[{"type":"ornek","art":"face"}]', now() - interval '2 hours'),
  (md5('abn:post:p2')::uuid, md5('abn:user:deniz')::uuid, 'paylasim',
   'Fragmanın ilk 20 saniyesi hazır. Müziği henüz oturtamadım.',
   md5('abn:project:palemouth')::uuid, md5('abn:task:t3')::uuid,
   '[{"type":"ornek","art":"video"}]', now() - interval '1 day'),
  (md5('abn:post:p3')::uuid, md5('abn:user:ruzgar')::uuid, 'paylasim',
   'Dedektif Michael için mekân moodboardu. 70’ler İstanbul havası düşünüyorum.',
   md5('abn:project:dedektif')::uuid, null,
   '[{"type":"ornek","art":"mood"}]', now() - interval '3 days')
on conflict (id) do nothing;

insert into public.comments (id, post_id, author_id, body, created_at) values
  (md5('abn:comment:c1')::uuid, md5('abn:post:p1')::uuid, md5('abn:user:ruzgar')::uuid,
   'Sağdaki çok iyi ama gözler biraz büyük mü?', now() - interval '90 minutes')
on conflict (id) do nothing;

update public.posts set pinned_comment_id = md5('abn:comment:c1')::uuid where id = md5('abn:post:p1')::uuid;

insert into public.hearts (user_id, post_id)
select md5('abn:user:' || u)::uuid, md5('abn:post:' || p)::uuid
from (values ('ruzgar', 'p1'), ('mert', 'p1'), ('ruzgar', 'p2'),
             ('selin', 'p3'), ('ece', 'p3'), ('mert', 'p3')) as v(u, p)
on conflict do nothing;

-- ───────────────────────── Fikir Defteri ─────────────────────────

insert into public.ideas (id, author_id, project_id, body, status, created_at)
select md5('abn:idea:' || v.k)::uuid, md5('abn:user:' || v.a)::uuid,
       case when v.p is null then null else md5('abn:project:' || v.p)::uuid end,
       v.body, v.status, now() - (v.age || ' days')::interval
from (values
  ('i1', 'selin', 'dedektif',  'Her dedektifin bir alışkanlığı olsun. Michael hep kalem çevirsin, oyuncu bunu sorguda ipucu olarak kullansın.', 'konusuluyor', 1),
  ('i2', 'mert',  null,        'Bir game jam’e katılalım, 48 saatte küçük bir oyun çıkaralım.', 'yeni', 2),
  ('i3', 'ece',   'palemouth', 'Ana menüde karakter nefes alıyormuş gibi hafif bir animasyon.', 'gorev', 6),
  ('i4', 'ruzgar','gumruk',    'Pasaport kontrolüne gelen her yolcunun küçük bir hikâyesi olsun.', 'simdilik', 12)
) as v(k, a, p, body, status, age)
on conflict (id) do nothing;

insert into public.hearts (user_id, idea_id)
select md5('abn:user:' || u)::uuid, md5('abn:idea:' || i)::uuid
from (values ('ruzgar', 'i1'), ('ruzgar', 'i3'), ('deniz', 'i3'), ('ece', 'i4')) as v(u, i)
on conflict do nothing;

-- ───────────────────────── Duyurular ─────────────────────────

insert into public.announcements (title, body, pinned, author_id, created_at) values
  ('Cumartesi 21:00 sesli toplantı',
   'PaleMouth demo planını konuşacağız. Gelemeyen not bıraksın, sorun değil.',
   true, md5('abn:user:ruzgar')::uuid, now() - interval '1 day'),
  ('Kasım hedefi: PaleMouth demo',
   'Ay sonuna kadar demo için gereken görevler havuzda. Bakıp ilgini çekeni al.',
   false, md5('abn:user:ruzgar')::uuid, now() - interval '5 days');

-- ───────────────────────── Bildirimler ─────────────────────────

insert into public.notifications (user_id, actor_id, kind, text, link, created_at, read_at)
select md5('abn:user:' || v.u)::uuid, md5('abn:user:' || v.a)::uuid, v.kind, v.text, v.link,
       now() - (v.age || ' hours')::interval, null
from (values
  ('ruzgar', 'deniz',  'yardim', 'Deniz, “Demo fragman kurgusu” görevinde yardım istiyor', '/gorevler', 2),
  ('ruzgar', 'selin',  'istek',  'Selin, “ABN web sitesi metinleri” görevini almak istiyor', '/yonetim/istekler', 3),
  ('ruzgar', 'mert',   'diger',  'Mert “PaleMouth logo taslakları” görevini bitirdi', '/gorevler', 48),
  ('ece',    'ruzgar', 'kalp',   'Rüzgar paylaşımına kalp bıraktı', '/akis', 1),
  ('selin',  'ruzgar', 'duyuru', 'Yeni sabit duyuru: Cumartesi 21:00 sesli toplantı', '/akis', 24),
  ('selin',  'ruzgar', 'diger',  'Havuza yeni görev düştü: Sorgu mekaniği notları', '/gorevler', 48)
) as v(u, a, kind, text, link, age);

-- ───────────────────────── Panolar ─────────────────────────
-- Prototipteki "Tüm panolar" kökü uygulamada pano listesi olduğu için tabloya girmez.

insert into public.boards (id, title, color, parent_board_id, project_id, created_by) values
  (md5('abn:board:pm')::uuid, 'PaleMouth',           'a2',      null, md5('abn:project:palemouth')::uuid, md5('abn:user:ruzgar')::uuid),
  (md5('abn:board:dd')::uuid, 'Dedektif Antolojisi', 'a3',      null, md5('abn:project:dedektif')::uuid,  md5('abn:user:ruzgar')::uuid),
  (md5('abn:board:ab')::uuid, 'ABN Genel',           'a1',      null, null,                               md5('abn:user:ruzgar')::uuid),
  (md5('abn:board:gm')::uuid, 'Gümrük Oyunu',        'surface', null, md5('abn:project:gumruk')::uuid,    md5('abn:user:ruzgar')::uuid)
on conflict (id) do nothing;
insert into public.boards (id, title, color, parent_board_id, created_by) values
  (md5('abn:board:mk')::uuid, 'Mekânlar', 'a3', md5('abn:board:pm')::uuid, md5('abn:user:ruzgar')::uuid)
on conflict (id) do nothing;

-- Kart verisi (data) biçimi:
--   heading/note/quote: { text }          image: { text, art | src }
--   todo:  { text, todos: [{ text, done }] }   color: { text, swatches: [...] }
--   link:  { text, url }                  board: { text, board_id }      zone: { text }
insert into public.board_items (id, board_id, type, x, y, w, h, color, z, data, created_by)
select md5('abn:item:' || v.k)::uuid, md5('abn:board:' || v.b)::uuid, v.type, v.x, v.y, v.w, v.h,
       v.color, case when v.type = 'zone' then -1 else 0 end, v.data::jsonb, md5('abn:user:ruzgar')::uuid
from (values
  -- PaleMouth
  ('pz1', 'pm', 'zone',    670, 84,  820, 350::real, 'a2',      '{"text":""}'),
  ('ph1', 'pm', 'heading', 60,  30,  300, null, 'surface', '{"text":"Karakterler"}'),
  ('pi1', 'pm', 'image',   60,  100, 280, null, 'surface', '{"text":"Ece · yüz ifadeleri, 1. tur","art":"face"}'),
  ('pn1', 'pm', 'note',    60,  380, 280, null, 'a1',      '{"text":"Ana karakter sessiz ve gözlemci. Konuşmaktan çok bakıyor."}'),
  ('pc1', 'pm', 'color',   370, 100, 270, null, 'surface', '{"text":"PaleMouth paleti","swatches":["#0E1F33","#2A384C","#BC4D4B","#F0B7B8","#EFEFEF"]}'),
  ('pt1', 'pm', 'todo',    370, 300, 270, null, 'surface', '{"text":"Demo için","todos":[{"text":"Ana menü animasyonu","done":false},{"text":"Kapı gıcırtısı sesi","done":true},{"text":"2. sahne arka planı","done":false},{"text":"Fragman müziği","done":false}]}'),
  ('ph2', 'pm', 'heading', 690, 30,  320, null, 'surface', '{"text":"Hikâye akışı"}'),
  ('pn2', 'pm', 'note',    690, 100, 220, null, 'surface', '{"text":"1 · Uyanış\nOyuncu boş bir evde uyanır."}'),
  ('pn3', 'pm', 'note',    970, 100, 220, null, 'surface', '{"text":"2 · Ayna\nYansıma bir saniye geç tepki veriyor."}'),
  ('pn4', 'pm', 'note',    1250,100, 220, null, 'a2',      '{"text":"3 · Kapı\nİlk seçim anı: aç ya da bekle."}'),
  ('pn5', 'pm', 'note',    1250,300, 220, null, 'a3',      '{"text":"Kötü son\nKapıyı açarsan…"}'),
  ('pn6', 'pm', 'note',    970, 300, 220, null, 'surface', '{"text":"İyi son\nBeklersen sabah olur."}'),
  ('pl1', 'pm', 'link',    60,  530, 240, null, 'surface', '{"text":"Ses referansları","url":"youtube.com/playlist?list=ornek"}'),
  ('pb1', 'pm', 'board',   690, 460, 240, null, 'a3',      '{"text":"Mekânlar","board_id":"' || md5('abn:board:mk')::uuid || '"}'),
  ('pi2', 'pm', 'image',   970, 460, 280, null, 'surface', '{"text":"Ev için ışık referansı","art":"mood"}'),
  -- Mekânlar
  ('mh1', 'mk', 'heading', 60,  30,  300, null, 'surface', '{"text":"Ev"}'),
  ('mi1', 'mk', 'image',   60,  100, 300, null, 'surface', '{"text":"Koridor ışığı","art":"mood"}'),
  ('mn1', 'mk', 'note',    400, 100, 260, null, 'a1',      '{"text":"70’ler, dar koridorlar, sarı ışık. Duvar kâğıdı soluk."}'),
  ('mn2', 'mk', 'note',    400, 250, 260, null, 'surface', '{"text":"Ayna odası: tek pencere, perdeler hep kapalı."}'),
  -- Dedektif Antolojisi
  ('dh1', 'dd', 'heading', 60,  30,  340, null, 'surface', '{"text":"Dedektif Michael"}'),
  ('di1', 'dd', 'image',   60,  100, 280, null, 'surface', '{"text":"70’ler İstanbul","art":"mood"}'),
  ('dn1', 'dd', 'note',    380, 100, 260, null, 'a2',      '{"text":"Alışkanlığı: kalem çevirmek. Sorguda ipucu olarak kullanılabilir."}'),
  ('dc1', 'dd', 'color',   380, 270, 270, null, 'surface', '{"text":"Michael paleti","swatches":["#6B4E3D","#C9A66B","#2F3B3A","#8C3B2E","#E8D9B5"]}'),
  ('dh2', 'dd', 'heading', 720, 30,  340, null, 'surface', '{"text":"Dedektif Jessica"}'),
  ('dn2', 'dd', 'note',    720, 100, 250, null, 'a3',      '{"text":"Henüz fikir aşamasında. Selin taslak yazıyor."}'),
  -- ABN Genel
  ('an1', 'ab', 'note',    60,  60,  260, null, 'a1',      '{"text":"Kasım hedefi: PaleMouth demosu"}'),
  ('at1', 'ab', 'todo',    360, 60,  270, null, 'surface', '{"text":"Instagram planı","todos":[{"text":"Haftalık süreç paylaşımı","done":false},{"text":"Ekip tanıtım videosu","done":false},{"text":"Logo yenileme","done":true}]}'),
  ('al1', 'ab', 'link',    670, 60,  240, null, 'surface', '{"text":"ABN Discord","url":"discord.gg/ornek"}'),
  -- Gümrük Oyunu
  ('gn1', 'gm', 'note',    60,  60,  280, null, 'surface', '{"text":"Şimdilik rafta. Fikirler kaybolmasın diye burada."}'),
  ('gn2', 'gm', 'note',    380, 60,  260, null, 'a2',      '{"text":"Pasaport kontrolüne gelen her yolcunun küçük bir hikâyesi olsun."}')
) as v(k, b, type, x, y, w, h, color, data)
on conflict (id) do nothing;

insert into public.board_links (board_id, from_item, to_item, start_cap, end_cap, dashed, bend_x, bend_y, created_by)
select md5('abn:board:' || v.b)::uuid, md5('abn:item:' || v.f)::uuid, md5('abn:item:' || v.t)::uuid,
       v.s, v.e, v.dash, v.bx, v.by, md5('abn:user:ruzgar')::uuid
from (values
  ('pm', 'pn2', 'pn3', 'none', 'arrow', false, 0::real, 0::real),
  ('pm', 'pn3', 'pn4', 'none', 'arrow', false, 0, 0),
  ('pm', 'pn4', 'pn5', 'none', 'arrow', false, 0, 0),
  ('pm', 'pn4', 'pn6', 'dot',  'arrow', true,  -40, 50),
  ('dd', 'dn1', 'dc1', 'none', 'arrow', false, 0, 0)
) as v(b, f, t, s, e, dash, bx, by);

commit;

-- ───────────────────────── Kendi hesabını Rüzgar'a bağlamak ─────────────────────────
-- Örnek Rüzgar hesabı yöneticidir ve verilerin çoğu ona bağlıdır. Kendi kullanıcı adını ve
-- şifreni vermek için SQL Editor'de çalıştır (<...> kısımlarını kendi bilgilerinle değiştir):
--
--   select public.admin_set_login(md5('abn:user:ruzgar')::uuid, '<kullanici-adin>', '<sifren>');
--
-- Diğer örnek kişilere şifre vermek ya da yeni üye açmak için Yönetim paneli → Üyeler.
