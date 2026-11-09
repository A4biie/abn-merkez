// Veritabanı testi: migration'ları ve seed'i PGlite (WASM Postgres) üzerinde çalıştırıp
// RLS ve claim_task senaryolarını dener. Supabase'in auth/storage şemaları shim.sql ile taklit edilir.
// Çalıştırmak için: npm run test:db

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Proje kökü: bu dosyanın iki üst klasörü.
const root = fileURLToPath(new URL('../../', import.meta.url));
const db = new PGlite({ extensions: { pgcrypto } });
const read = (p) => readFileSync(p, 'utf8');

await db.exec(read(new URL('./shim.sql', import.meta.url)));
const migDir = join(root, 'supabase', 'migrations');
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
  try { await db.exec(read(join(migDir, f))); console.log('OK migration', f); }
  catch (e) { console.log('FAIL migration', f, e.message); process.exit(1); }
}
try { await db.exec(read(join(root, 'supabase', 'seed.sql'))); console.log('OK seed'); }
catch (e) { console.log('FAIL seed', e.message); process.exit(1); }

const uid = async (k) => (await db.query(`select md5('abn:user:${k}')::uuid as id`)).rows[0].id;
const id = async (kind, k) => (await db.query(`select md5('abn:${kind}:${k}')::uuid as id`)).rows[0].id;

let pass = 0, fail = 0;
function check(name, cond, info) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, info === undefined ? '' : JSON.stringify(info)); }
}
async function as(who, fn) {
  if (who === 'anon') await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  else await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${await uid(who)}', false);`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}
async function q(sql, params) {
  try { const r = await db.query(sql, params); return { rows: r.rows, n: r.affectedRows ?? r.rows.length }; }
  catch (e) { return { error: e.message }; }
}
const claim = async (who, task) => as(who, async () => (await q(`select public.claim_task($1) as r`, [await id('task', task)])).rows?.[0]?.r);

console.log('\n— sayımlar');
const counts = (await db.query(`select (select count(*) from profiles) p, (select count(*) from tasks) t,
  (select count(*) from board_items) bi, (select count(*) from board_links) bl, (select count(*) from boards) b,
  (select progress from projects where slug='palemouth') prog,
  (select project_id from boards where title='Mekânlar') = md5('abn:project:palemouth')::uuid as mk_inherit`)).rows[0];
console.log(counts);
check('5 profil', Number(counts.p) === 5);
check('PaleMouth ilerlemesi 40', counts.prog === 40);
check('Alt pano projeyi miras alır', counts.mk_inherit === true);

console.log('\n— tr_dative');
const dat = (await db.query(`select string_agg(public.tr_dative(n), ' ') s from unnest(array['Rüzgar','Ece','Selin','Mert','Deniz','Ali','Okan','Ayşe']) n`)).rows[0].s;
check('ekler doğru', dat === 'Rüzgar’a Ece’ye Selin’e Mert’e Deniz’e Ali’ye Okan’a Ayşe’ye', dat);

console.log('\n— claim_task');
let r = await claim('selin', 't2');
check('Selin PaleMouth görevini alamaz (proje dışı)', r.ok === false && r.code === 'proje_disi', r);
console.log('    ', r.title, '|', r.reason);
r = await claim('selin', 't6');
check('Selin Çizer kilitli görevi alamaz', r.ok === false && r.code === 'kilit_rol', r);
console.log('    ', r.reason);
r = await claim('mert', 't12');
check('Mert admin kilitli görevi alamaz', r.ok === false && r.code === 'kilit_admin', r);
console.log('    ', r.reason);
r = await claim('selin', 't12');
check('Selin\'in bekleyen isteği görünür', r.request_pending === true, r);
r = await claim('ece', 't6');
check('Ece (Çizer) Çizer görevini alır', r.ok === true, r);
r = await claim('mert', 't6');
check('Alınmış görev ikinci kez alınamaz', r.ok === false && r.code === 'alinmis', r);
r = await claim('selin', 't5');
check('Selin kendi projesindeki havuz görevini alır', r.ok === true, r);
r = await claim('ruzgar', 't2');
check('Admin her görevi alabilir', r.ok === true, r);
const t6 = (await db.query(`select status, assignee_id = $1 as mine from tasks where id = $2`, [await uid('ece'), await id('task', 't6')])).rows[0];
check('t6 artık Ece\'de ve "bende"', t6.status === 'bende' && t6.mine, t6);

console.log('\n— görev RLS');
let res = await as('selin', async () => q(`update tasks set assignee_id = auth.uid(), status = 'bende' where id = $1`, [await id('task', 't7')]));
check('Selin havuzdan doğrudan alamaz (0 satır)', res.n === 0, res);
res = await as('selin', async () => q(`update tasks set status = 'incelemede' where id = $1`, [await id('task', 't4')]));
check('Selin kendi görevini ilerletir', res.n === 1, res);
res = await as('selin', async () => q(`update tasks set lock_type = 'admin' where id = $1`, [await id('task', 't4')]));
check('Selin kilit değiştiremez', !!res.error, res);
res = await as('selin', async () => q(`update tasks set assignee_id = $2 where id = $1`, [await id('task', 't4'), await uid('ece')]));
check('Selin görevini başkasına veremez', !!res.error || res.n === 0, res);
res = await as('deniz', async () => q(`update tasks set assignee_id = null, status = 'havuz' where id = $1`, [await id('task', 't3')]));
check('Deniz görevini havuza bırakabilir', res.n === 1, res);
res = await as('selin', async () => q(`insert into tasks (title, project_id) values ('x', $1)`, [await id('project', 'palemouth')]));
check('Selin üyesi olmadığı projeye görev ekleyemez', !!res.error, res);
res = await as('selin', async () => q(`insert into tasks (title) values ('Projesiz görev') returning created_by = auth.uid() as mine`));
check('Selin projesiz görev ekler', res.rows?.[0]?.mine === true, res);
res = await as('selin', async () => q(`insert into tasks (title, lock_type) values ('x', 'admin')`));
check('Selin kilitli görev ekleyemez', !!res.error, res);

console.log('\n— profil ve kâr payı');
res = await as('selin', async () => q(`update profiles set bio = 'yeni' where id = auth.uid()`));
check('Selin kendi biyografisini düzenler', res.n === 1, res);
res = await as('selin', async () => q(`update profiles set is_admin = true where id = auth.uid()`));
check('Selin kendini admin yapamaz', !!res.error, res);
res = await as('selin', async () => q(`update profiles set bio = 'x' where id = $1`, [await uid('ece')]));
check('Selin başkasının profilini düzenleyemez', res.n === 0, res);
res = await as('selin', async () => q(`select user_id from profit_shares`));
check('Selin sadece kendi kâr payını görür', res.rows?.length === 1, res);
res = await as('ruzgar', async () => q(`select user_id from profit_shares`));
check('Admin hepsini görür', res.rows?.length === 5, res);
res = await as('ruzgar', async () => q(`update profiles set role_title = 'Programcı' where id = $1`, [await uid('mert')]));
check('Admin rol değiştirir', res.n === 1, res);

console.log('\n— admin işleri');
res = await as('selin', async () => q(`insert into announcements (title) values ('x')`));
check('Selin duyuru açamaz', !!res.error, res);
res = await as('selin', async () => q(`update projects set status = 'yayinda'`));
check('Selin projeyi değiştiremez', res.n === 0, res);
res = await as('selin', async () => q(`update requests set status = 'onaylandi'`));
check('Selin istek onaylayamaz', res.n === 0, res);
res = await as('ruzgar', async () => q(`update requests set status = 'onaylandi' where requester_id = $1 and status = 'bekliyor'`, [await uid('mert')]));
check('Admin Mert\'in katılımını onaylar', res.n === 1, res);
res = await q(`select 1 from project_members where project_id = $1 and user_id = $2`, [await id('project', 'dedektif'), await uid('mert')]);
check('Mert artık Dedektif üyesi', res.rows.length === 1, res);
res = await as('ruzgar', async () => q(`update requests set status = 'onaylandi' where requester_id = $1 and status = 'bekliyor'`, [await uid('selin')]));
res = await q(`select status, assignee_id = $2 as ok from tasks where id = $1`, [await id('task', 't12'), await uid('selin')]);
check('Onaylanan görev isteği görevi Selin\'e verir', res.rows[0].ok === true && res.rows[0].status === 'bende', res);
res = await as('ruzgar', async () => q(`insert into announcements (title, pinned) values ('Yeni sabit', true)`));
res = await q(`select count(*)::int c from announcements where pinned`);
check('Tek sabit duyuru kalır', res.rows[0].c === 1, res);

console.log('\n— istekler');
res = await as('mert', async () => q(`insert into requests (kind, requester_id, task_id) values ('gorev', auth.uid(), $1)`, [await id('task', 't7')]));
check('Mert görev isteği açar', res.n === 1, res);
res = await as('mert', async () => q(`insert into requests (kind, requester_id, task_id) values ('gorev', auth.uid(), $1)`, [await id('task', 't7')]));
check('Aynı istek iki kez açılamaz', !!res.error, res);
res = await as('mert', async () => q(`insert into requests (kind, requester_id, task_id) values ('gorev', $2, $1)`, [await id('task', 't7'), await uid('ece')]));
check('Başkası adına istek açılamaz', !!res.error, res);

console.log('\n— akış');
res = await as('selin', async () => q(`insert into hearts (user_id, post_id) values (auth.uid(), $1)`, [await id('post', 'p1')]));
check('Selin kalp bırakır', res.n === 1, res);
res = await as('selin', async () => q(`insert into hearts (user_id, post_id) values (auth.uid(), $1)`, [await id('post', 'p1')]));
check('İkinci kalp olmaz', !!res.error, res);
res = await as('selin', async () => q(`insert into hearts (user_id, post_id) values ($2, $1)`, [await id('post', 'p2'), await uid('ece')]));
check('Başkası adına kalp olmaz', !!res.error, res);
res = await as('selin', async () => q(`update posts set body = 'x' where id = $1`, [await id('post', 'p1')]));
check('Selin Ece\'nin postunu düzenleyemez', res.n === 0, res);
res = await as('ece', async () => q(`update posts set pinned_comment_id = null where id = $1`, [await id('post', 'p1')]));
check('Ece kendi postunda sabitlemeyi kaldırır', res.n === 1, res);
res = await as('ece', async () => q(`update posts set pinned_comment_id = $2 where id = $1`, [await id('post', 'p2'), await id('comment', 'c1')]));
check('Başka postun yorumu sabitlenemez', !!res.error || res.n === 0, res);
res = await as('selin', async () => q(`select count(*)::int c, count(*) filter (where user_id <> auth.uid())::int other from notifications`));
check('Selin sadece kendi bildirimlerini görür', res.rows?.[0]?.c > 0 && res.rows[0].other === 0, res);

console.log('\n— panolar');
res = await as('selin', async () => q(`update board_items set x = 1 where board_id = $1`, [await id('board', 'pm')]));
check('Selin PaleMouth panosunu düzenleyemez', res.n === 0, res);
res = await as('selin', async () => q(`update board_items set x = 1 where board_id = $1`, [await id('board', 'ab')]));
check('Selin genel panoyu düzenler', res.n === 3, res);
res = await as('ece', async () => q(`update board_items set x = 1 where board_id = $1`, [await id('board', 'mk')]));
check('Ece alt panoyu (Mekânlar) düzenler', res.n === 4, res);
res = await as('selin', async () => q(`insert into boards (title) values ('Selin panosu') returning id`));
check('Selin genel pano açar', res.n === 1, res);
res = await as('selin', async () => q(`insert into boards (title, project_id) values ('x', $1)`, [await id('project', 'palemouth')]));
check('Selin PaleMouth panosu açamaz', !!res.error, res);
res = await as('ece', async () => q(`insert into board_links (board_id, from_item, to_item) values ($1, $2, $3)`, [await id('board', 'pm'), await id('item', 'pn1'), await id('item', 'mn1')]));
check('Farklı panolar arası bağlantı olmaz', !!res.error, res);

console.log('\n— storage');
const selin = await uid('selin'), ece = await uid('ece');
res = await as('selin', async () => q(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${selin}/a.png`]));
check('Selin kendi avatar klasörüne yükler', res.n === 1, res);
res = await as('selin', async () => q(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${ece}/a.png`]));
check('Selin Ece\'nin klasörüne yükleyemez', !!res.error, res);
res = await as('selin', async () => q(`insert into storage.objects (bucket_id, name) values ('board-files', $1)`, [`${await id('board', 'pm')}/x.pdf`]));
check('Selin PaleMouth panosuna dosya yükleyemez', !!res.error, res);
res = await as('selin', async () => q(`insert into storage.objects (bucket_id, name) values ('board-files', $1)`, [`${await id('board', 'ab')}/x.pdf`]));
check('Selin genel panoya dosya yükler', res.n === 1, res);
res = await as('selin', async () => q(`insert into storage.objects (bucket_id, name) values ('board-files', 'bozuk/x.pdf')`));
check('Bozuk yol reddedilir', !!res.error, res);

console.log('\n— anon');
res = await as('anon', async () => q(`select * from profiles`));
check('Giriş yapmayan profil göremez', !!res.error, res);
res = await as('anon', async () => q(`select public.claim_task($1)`, [await id('task', 't7')]));
check('Giriş yapmayan claim_task çağıramaz', !!res.error, res);

console.log('\n— bildirimler');
const notesOf = async (who) => (await db.query(`select kind, text from notifications where user_id = $1 order by created_at desc`, [await uid(who)])).rows;
const seeded = (await notesOf('ece')).filter((n) => n.kind === 'gorev_atama').length;
check('Seed bildirim üretmez (SQL Editor)', seeded === 0, seeded);
res = await as('mert', async () => q(`insert into comments (post_id, author_id, body) values ($1, auth.uid(), 'Bence çok iyi olmuş')`, [await id('post', 'p1')]));
let en = await notesOf('ece');
check('Yorum post sahibine bildirilir', en[0]?.kind === 'yorum' && en[0].text.startsWith('Mert paylaşımına yorum yaptı'), en[0]);
await as('ece', async () => q(`insert into comments (post_id, author_id, body) values ($1, auth.uid(), 'kendime not')`, [await id('post', 'p1')]));
check('Kendi postuna yorum bildirim üretmez', (await notesOf('ece')).length === en.length);
await as('deniz', async () => q(`insert into hearts (user_id, idea_id) values (auth.uid(), $1)`, [await id('idea', 'i2')]));
const mn = await notesOf('mert');
check('Fikre kalp sahibine bildirilir', mn[0]?.text === 'Deniz fikrine kalp bıraktı', mn[0]);
const adminBefore = (await notesOf('ruzgar')).length;
await as('ece', async () => q(`insert into requests (kind, requester_id, project_id) values ('proje', auth.uid(), $1)`, [await id('project', 'dedektif')]));
const rn = await notesOf('ruzgar');
check('Yeni istek yöneticiye gider', rn.length === adminBefore + 1 && rn[0].kind === 'istek' && rn[0].text.includes('Dedektif Antolojisi projesine katılmak istiyor'), rn[0]);
await as('ruzgar', async () => q(`update requests set status = 'reddedildi' where requester_id = auth.uid() is not null and requester_id = $1 and status = 'bekliyor'`, [await uid('ece')]));
en = await notesOf('ece');
check('Reddedilen istek nazikçe bildirilir', en[0]?.kind === 'istek_cevap' && en[0].text.includes('şimdilik olmadı'), en[0]);
await as('ruzgar', async () => q(`insert into announcements (title, pinned) values ('Pazar buluşması', true)`));
check('Sabit duyuru herkese gider', (await notesOf('deniz'))[0]?.text === 'Yeni sabit duyuru: Pazar buluşması');
check('Duyuruyu yapan kendine bildirim almaz', (await notesOf('ruzgar')).every((n) => !n.text.includes('Pazar')));
await as('ruzgar', async () => q(`update tasks set assignee_id = $2, status = 'bende' where id = $1`, [await id('task', 't7'), await uid('mert')]));
check('Admin ataması kişiye bildirilir', (await notesOf('mert'))[0]?.text === 'Rüzgar “Ekip tanıtım videosu metni” görevini sana verdi');
const dn = (await notesOf('deniz')).length;
await as('ece', async () => q(`update tasks set needs_help = true where id = $1`, [await id('task', 't1')]));
check('Yardım isteği yöneticiye gider', (await notesOf('ruzgar'))[0]?.text === 'Ece, “Ana karakter yüz ifadeleri” görevinde yardım istiyor');
check('Yardım isteği admin olmayana gitmez', (await notesOf('deniz')).length === dn);
res = await as('selin', async () => q(`select public.ask_still_yours($1)`, [await id('task', 't1')]));
check('Nazikçe sor sadece yönetici', !!res.error, res);
await as('ruzgar', async () => q(`select public.ask_still_yours($1)`, [await id('task', 't1')]));
check('Nazikçe sor sahibine gider', (await notesOf('ece'))[0]?.kind === 'soru');
res = await as('selin', async () => q(`insert into notifications (user_id, kind, text) values ($1, 'diger', 'sahte')`, [await uid('ece')]));
check('İstemci bildirim yazamaz', !!res.error, res);

console.log('\n— yönetici ve push');
res = await as('ruzgar', async () => q(`update profiles set is_admin = false where id = auth.uid()`));
check('Son yönetici yetkisini bırakamaz', !!res.error && res.error.includes('en az bir yönetici'), res);
res = await as('ruzgar', async () => q(`update profiles set is_admin = true where id = $1`, [await uid('selin')]));
res = await as('ruzgar', async () => q(`update profiles set is_admin = false where id = auth.uid()`));
check('Başka yönetici varsa bırakabilir', !res.error, res);
res = await as('selin', async () => q(`insert into push_tokens (token, user_id) values ('ExponentPushToken[x]', auth.uid())`));
check('Kişi kendi push jetonunu kaydeder', res.n === 1, res);
res = await as('mert', async () => q(`select * from push_tokens`));
check('Başkasının jetonu görünmez', res.rows?.length === 0, res);

console.log('\n— kullanıcı adı ve şifre');
const asSql = () => db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
await asSql();
await db.exec(`update profiles set is_admin = true where id = md5('abn:user:ruzgar')::uuid;
  update profiles set is_admin = false where id <> md5('abn:user:ruzgar')::uuid;`);
const login = async (k) => (await db.query(
  `select u.email, p.username, u.encrypted_password from auth.users u join profiles p on p.id = u.id where u.id = $1`, [await uid(k)])).rows[0];
const pwOk = async (k, pw) => (await db.query(
  `select encrypted_password = extensions.crypt($2, encrypted_password) as ok from auth.users where id = $1`, [await uid(k), pw])).rows[0].ok;
let lg = await login('ece');
check('Örnek kişinin kullanıcı adı e-postasından gelir', lg.username === 'ece' && lg.email === 'ece@abnmerkez.local', lg);
res = await q(`select public.admin_set_login(md5('abn:user:ruzgar')::uuid, 'A4biie', 'deneme-sifre')`);
check('SQL Editor\'den kullanıcı adı ve şifre verilir', !res.error, res);
lg = await login('ruzgar');
check('Kullanıcı adı küçük harfe iner, e-posta eşlenir', lg.username === 'a4biie' && lg.email === 'a4biie@abnmerkez.local', lg);
check('Şifre bcrypt ile saklanır', lg.encrypted_password.startsWith('$2') && await pwOk('ruzgar', 'deneme-sifre'));
const ident = (await db.query(`select identity_data->>'email' e from auth.identities where user_id = $1`, [await uid('ruzgar')])).rows[0].e;
check('Kimlik kaydı da yeni e-postayı taşır', ident === 'a4biie@abnmerkez.local', ident);
res = await as('selin', async () => q(`select public.admin_set_login($1, null, 'ele-gecir')`, [await uid('ruzgar')]));
check('Yönetici olmayan başkasının şifresini değiştiremez', !!res.error && res.error.includes('sadece yöneticiler'), res);
check('...ve şifre aynı kalır', await pwOk('ruzgar', 'deneme-sifre'));
res = await as('selin', async () => q(`update profiles set username = 'selin2' where id = auth.uid()`));
check('Kişi kendi kullanıcı adını değiştiremez', !!res.error && res.error.includes('Kullanıcı adını'), res);
res = await as('ruzgar', async () => q(`select public.admin_set_login($1, null, '123')`, [await uid('selin')]));
check('Kısa şifre reddedilir', !!res.error && res.error.includes('en az 6'), res);
res = await as('ruzgar', async () => q(`select public.admin_set_login($1, 'ece', null)`, [await uid('selin')]));
check('Alınmış kullanıcı adı reddedilir', !!res.error && res.error.includes('alınmış'), res);
res = await as('ruzgar', async () => q(`select public.admin_set_login($1, 'Ç ok', null)`, [await uid('selin')]));
check('Geçersiz kullanıcı adı reddedilir', !!res.error && res.error.includes('3-32'), res);
res = await as('ruzgar', async () => q(`select public.admin_set_login($1, null, 'selin-sifre')`, [await uid('selin')]));
check('Yönetici şifre belirler', !res.error && await pwOk('selin', 'selin-sifre'), res);
res = await as('ruzgar', async () => q(`select public.admin_create_member('yeni.uye', 'Yeni Üye', 'ilk-sifre') as id`));
const newId = res.rows?.[0]?.id;
const np = newId && (await db.query(`select p.username, p.full_name, u.email, u.email_confirmed_at is not null as confirmed,
  (select count(*) from auth.identities i where i.user_id = u.id)::int as idents,
  exists (select 1 from profit_shares s where s.user_id = u.id) as share
  from profiles p join auth.users u on u.id = p.id where p.id = $1`, [newId])).rows[0];
check('Yönetici yeni üye açar (profil, onaylı e-posta, kimlik, kâr payı satırı)',
  np?.username === 'yeni.uye' && np.full_name === 'Yeni Üye' && np.email === 'yeni.uye@abnmerkez.local' && np.confirmed && np.idents === 1 && np.share, np ?? res);
res = await as('ruzgar', async () => q(`select public.admin_create_member('yeni.uye', 'Başkası', 'ilk-sifre')`));
check('Aynı kullanıcı adıyla ikinci hesap açılmaz', !!res.error && res.error.includes('alınmış'), res);
res = await as('mert', async () => q(`select public.admin_create_member('gizli', 'Gizli', 'ilk-sifre')`));
check('Yönetici olmayan üye açamaz', !!res.error && res.error.includes('sadece yöneticiler'), res);
res = await as('anon', async () => q(`select public.admin_create_member('gizli', 'Gizli', 'ilk-sifre')`));
check('Giriş yapmamış kişi fonksiyonu çağıramaz', !!res.error, res);
await asSql();
await db.exec(`insert into auth.users (id, email, encrypted_password) values (gen_random_uuid(), 'Mert.K@gmail.com', '')`);
const other = (await db.query(`select username from profiles where full_name = 'Mert.K'`)).rows[0];
check('Başka biçimde açılan hesaba boşta bir kullanıcı adı verilir', other?.username === 'mert.k', other);

console.log('\n— sohbet');
await asSql();
const roomOf = async (project) => (await db.query(`select id from chat_rooms where project_id = md5('abn:project:${project}')::uuid`)).rows[0]?.id;
const genel = (await db.query(`select id from chat_rooms where kind = 'genel'`)).rows[0]?.id;
const pm = await roomOf('palemouth');
const sizes = (await db.query(`select (select count(*)::int from chat_members where room_id = $1) g, (select count(*)::int from profiles) p,
  (select count(*)::int from chat_members where room_id = $2) pm, (select count(*)::int from project_members where project_id = md5('abn:project:palemouth')::uuid) pmm`, [genel, pm])).rows[0];
check('Herkes genel odada', sizes.g === sizes.p, sizes);
check('Proje odası proje üyeleriyle açılır', !!pm && sizes.pm === sizes.pmm, sizes);
const selinRooms = await as('selin', async () => q(`select kind, project_id from chat_rooms`));
const selinProjects = (await db.query(`select array_agg(project_id::text order by project_id) ids from project_members where user_id = $1`, [await uid('selin')])).rows[0].ids ?? [];
const seen = (selinRooms.rows ?? []).filter((r) => r.kind === 'proje').map((r) => r.project_id).sort();
check('Kişi sadece üyesi olduğu odaları görür', (selinRooms.rows ?? []).filter((r) => r.kind === 'genel').length === 1 && JSON.stringify(seen) === JSON.stringify(selinProjects), { seen, selinProjects });
res = await as('ruzgar', async () => q(`insert into messages (room_id, author_id, body) values ($1, auth.uid(), 'Sadece PaleMouth ekibi görsün @selin') returning id`, [pm]));
check('Üye proje odasına yazar', res.n === 1, res);
const pmMsg = res.rows?.[0]?.id;
res = await as('selin', async () => q(`select * from messages where room_id = $1`, [pm]));
check('Üye olmayan proje odasının mesajlarını göremez', res.rows?.length === 0, res);
res = await as('selin', async () => q(`insert into messages (room_id, author_id, body) values ($1, auth.uid(), 'sızma')`, [pm]));
check('Üye olmayan odaya yazamaz', !!res.error, res);
let n = (await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'anma'`, [await uid('selin')])).rows[0].n;
check('Odada olmayan kişi anılsa da bildirim almaz', n === 0, n);
res = await as('ece', async () => q(`insert into messages (room_id, author_id, body) values ($1, auth.uid(), '@Mert logoya bakar mısın?') returning id`, [genel]));
const eceMsg = res.rows?.[0]?.id;
n = (await db.query(`select text, link from notifications where user_id = $1 and kind = 'anma'`, [await uid('mert')])).rows;
check('"@kullanıcıadı" ile anılan kişiye bildirim gider', n.length === 1 && n[0].link === `/sohbet/${genel}`, n);
res = await as('mert', async () => q(`select unread from chat_overview() where kind = 'genel'`));
check('Okunmamış mesaj noktası görünür', res.rows?.[0]?.unread === true, res);
res = await as('mert', async () => q(`insert into chat_reads (room_id, user_id) values ($1, auth.uid())
  on conflict (room_id, user_id) do update set last_read_at = now()`, [genel]));
res = await as('mert', async () => q(`select unread from chat_overview() where kind = 'genel'`));
check('Oda açılınca nokta kalkar', res.rows?.[0]?.unread === false, res);
res = await as('ece', async () => q(`select * from chat_reads`));
check('"Görüldü" yok: başkasının okuma kaydı görünmez', res.rows?.length === 0, res);
res = await as('ece', async () => q(`update messages set body = '@Mert logoya bakar mısın? (ikinci sürüm)' where id = $1 returning edited_at`, [eceMsg]));
check('Kişi kendi mesajını düzenler, düzenlendi işareti konur', !!res.rows?.[0]?.edited_at, res);
res = await as('mert', async () => q(`update messages set body = 'değiştirdim' where id = $1`, [eceMsg]));
check('Başkasının mesajı düzenlenemez', res.n === 0, res);
res = await as('ece', async () => q(`update messages set room_id = $2 where id = $1`, [eceMsg, pm]));
check('Mesajın odası değiştirilemez', !!res.error, res);
res = await as('mert', async () => q(`insert into message_hearts (message_id, user_id) values ($1, auth.uid())`, [eceMsg]));
check('Mesaja kalp bırakılır', res.n === 1, res);
res = await as('selin', async () => q(`insert into message_hearts (message_id, user_id) values ($1, auth.uid())`, [pmMsg]));
check('Göremediği mesaja kalp bırakamaz', !!res.error, res);
res = await as('mert', async () => q(`select public.delete_message($1)`, [eceMsg]));
check('Başkasının mesajını yönetici olmayan silemez', !!res.error && res.error.includes('yöneticiler'), res);
res = await as('ruzgar', async () => q(`select public.delete_message($1)`, [eceMsg]));
const del = (await db.query(`select body, deleted_at is not null d, (select count(*)::int from message_hearts where message_id = $1) h from messages where id = $1`, [eceMsg])).rows[0];
check('Yönetici her mesajı siler (içerik ve kalpler temizlenir)', !res.error && del.d && del.body === '' && del.h === 0, { res, del });
res = await as('ece', async () => q(`update messages set body = 'geri getir' where id = $1`, [eceMsg]));
check('Silinmiş mesaj düzenlenemez', !!res.error, res);
res = await as('ece', async () => q(`select public.open_direct_room($1) as id`, [await uid('mert')]));
const dm = res.rows?.[0]?.id;
res = await as('mert', async () => q(`select public.open_direct_room($1) as id`, [await uid('ece')]));
check('Özel oda iki taraftan da aynı', !!dm && res.rows?.[0]?.id === dm, res);
res = await as('selin', async () => q(`select * from chat_rooms where id = $1`, [dm]));
check('Özel odayı üçüncü kişi göremez', res.rows?.length === 0, res);
res = await as('ruzgar', async () => q(`select * from chat_rooms where id = $1`, [dm]));
check('Yönetici de başkalarının özel odasını göremez', res.rows?.length === 0, res);
res = await as('ruzgar', async () => q(`insert into project_members (project_id, user_id) values (md5('abn:project:palemouth')::uuid, $1)`, [await uid('selin')]));
res = await as('selin', async () => q(`select count(*)::int n from messages where room_id = $1`, [pm]));
check('Projeye eklenen kişi proje odasına girer', res.rows?.[0]?.n === 1, res);
res = await as('ruzgar', async () => q(`delete from project_members where project_id = md5('abn:project:palemouth')::uuid and user_id = $1`, [await uid('selin')]));
res = await as('selin', async () => q(`select count(*)::int n from messages where room_id = $1`, [pm]));
check('Projeden çıkan kişi odadan da çıkar', res.rows?.[0]?.n === 0, res);
res = await as('ruzgar', async () => q(`insert into projects (name) values ('Yeni Oyun') returning id`));
const newRoom = (await db.query(`select title from chat_rooms where project_id = $1`, [res.rows?.[0]?.id])).rows[0];
check('Yeni projeye otomatik oda açılır', newRoom?.title === 'Yeni Oyun', newRoom);

console.log('\n— oylama');
res = await as('ece', async () => q(`insert into posts (author_id, type, body) values (auth.uid(), 'oylama', 'yarım')`));
check('Oylama doğrudan post olarak açılamaz', !!res.error, res);
res = await as('ece', async () => q(`select public.create_poll('Tek seçenek?', null, '[{"body":"A"}]'::jsonb)`));
check('Tek seçenekli oylama reddedilir', !!res.error && res.error.includes('2 ile 6'), res);
const opts = JSON.stringify([{ body: 'Mor logo' }, { body: 'Yeşil logo' }, { body: 'İkisi de olmasın' }]);
res = await as('ece', async () => q(`select public.create_poll('Hangi logo?', null, $1::jsonb, false, true) as id`, [opts]));
const anonPoll = res.rows?.[0]?.id;
check('Oylama açılır', !!anonPoll, res);
const optIds = (await db.query(`select id from poll_options where post_id = $1 order by position`, [anonPoll])).rows.map((r) => r.id);
const results = (who, post) => as(who, async () => q(`select * from poll_results(array[$1]::uuid[])`, [post]));
res = await as('selin', async () => q(`select public.poll_vote($1, array[$2, $3]::uuid[])`, [anonPoll, optIds[0], optIds[1]]));
check('Tek seçimde iki seçenek reddedilir', !!res.error, res);
res = await as('selin', async () => q(`select public.poll_vote($1, array[$2]::uuid[])`, [anonPoll, optIds[0]]));
check('Oy verilir', !res.error, res);
res = await results('mert', anonPoll);
check('Oy vermeden sonuç görünmez ("oy verince" ayarı)', res.rows?.every((r) => r.votes === null && r.visible === false), res);
res = await as('mert', async () => q(`select public.poll_vote($1, array[$2]::uuid[])`, [anonPoll, optIds[1]]));
res = await results('mert', anonPoll);
check('Oy verince toplamlar görünür', res.rows?.[0]?.votes === 1 && res.rows?.[1]?.votes === 1 && res.rows?.[0]?.total_voters === 2 && res.rows?.[1]?.mine === true, res);
check('İsimsiz oylamada kimin oy verdiği dönmez', res.rows?.every((r) => r.voters === null), res);
res = await as('ruzgar', async () => q(`select * from poll_votes`));
check('Yönetici dahil kimse oy tablosunu okuyamaz', res.rows?.length === 0 || !!res.error, res);
res = await as('mert', async () => q(`insert into poll_votes (post_id, option_id, user_id, multiple) values ($1, $2, auth.uid(), false)`, [anonPoll, optIds[2]]));
check('Oy tabloya doğrudan yazılamaz', !!res.error, res);
res = await as('selin', async () => q(`select public.poll_vote($1, array[$2]::uuid[])`, [anonPoll, optIds[1]]));
res = await results('selin', anonPoll);
check('Oy değiştirilebilir', res.rows?.[0]?.votes === 0 && res.rows?.[1]?.votes === 2 && res.rows?.[1]?.mine, res);
res = await as('mert', async () => q(`select public.poll_close($1)`, [anonPoll]));
check('Açan kişi ya da yönetici değilse erken bitiremez', !!res.error, res);
await asSql();
await db.exec(`delete from notifications where kind = 'oylama'`);
res = await as('ece', async () => q(`select public.poll_close($1)`, [anonPoll]));
check('Açan kişi oylamayı erken bitirir', !res.error, res);
n = (await db.query(`select user_id from notifications where kind = 'oylama' and link = $1`, [`/akis?post=${anonPoll}`])).rows.map((r) => r.user_id).sort();
check('Bitince oy verenlere "Oylama sonuçlandı" bildirimi gider', n.length === 2 && n.includes(await uid('selin')) && n.includes(await uid('mert')), n);
res = await as('selin', async () => q(`select public.poll_vote($1, array[$2]::uuid[])`, [anonPoll, optIds[0]]));
check('Bitmiş oylamada oy değişmez', !!res.error && res.error.includes('bitti'), res);
res = await as('mert', async () => q(`select public.create_poll('Kapak?', null, $1::jsonb, true, false, now() + interval '1 day', 'bitince') as id`, [opts]));
const namedPoll = res.rows?.[0]?.id;
const nOpts = (await db.query(`select id from poll_options where post_id = $1 order by position`, [namedPoll])).rows.map((r) => r.id);
res = await as('ece', async () => q(`select public.poll_vote($1, array[$2, $3]::uuid[])`, [namedPoll, nOpts[0], nOpts[1]]));
check('Çoklu seçimde birden çok seçenek seçilir', !res.error, res);
res = await results('ece', namedPoll);
check('"Bitince" ayarında oy verse de sonuç gizli', res.rows?.every((r) => r.votes === null) && res.rows?.[0]?.mine, res);
await asSql();
await db.exec(`update polls set ends_at = now() - interval '1 minute' where post_id = '${namedPoll}'`);
const due = (await db.query(`select public.poll_finish_due() as n`)).rows[0].n;
res = await results('selin', namedPoll);
check('Süresi dolunca isimli oylamada kim seçti görünür', res.rows?.[0]?.voters?.[0] === await uid('ece') && res.rows?.[0]?.votes === 1, res);
n = (await db.query(`select count(*)::int n from notifications where kind = 'oylama' and link = $1`, [`/akis?post=${namedPoll}`])).rows[0].n;
check('Süre dolunca zamanlanmış iş bildirim gönderir (bir kez)', due === 1 && n === 1 && (await db.query(`select public.poll_finish_due() as n`)).rows[0].n === 0, { due, n });

console.log('\n— temalar');
res = await as('ece', async () => q(`update profiles set theme = 'indigo' where id = auth.uid()`));
check('Kaldırılmış tema seçilemez', !!res.error, res);
res = await as('ece', async () => q(`update profiles set theme = 'gece' where id = auth.uid() returning theme`));
check('Kalan 4 temadan biri seçilir', res.rows?.[0]?.theme === 'gece', res);

console.log('\n— ilk giriş');
res = await as('ece', async () => q(`select onboarded, skills from profiles where id = auth.uid()`));
check('Yeni profil turu görmemiş sayılır', res.rows?.[0]?.onboarded === false && res.rows[0].skills.length === 0, res);
res = await as('ece', async () =>
  q(`update profiles set onboarded = true, skills = array['Çizer','Yazar'] where id = auth.uid() returning onboarded, skills`),
);
check('Kişi turu bitirip becerilerini kaydeder', res.rows?.[0]?.onboarded === true && res.rows[0].skills.length === 2, res);
res = await as('ece', async () => q(`update profiles set skills = array_fill('x'::text, array[13]) where id = auth.uid()`));
check('En fazla 12 beceri', !!res.error, res);
res = await as('ece', async () => q(`update profiles set onboarded = false where id <> auth.uid()`));
check('Başkasının tur durumu değiştirilemez', !res.error && (res.rowCount ?? 0) === 0, res);


console.log(`\n${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
