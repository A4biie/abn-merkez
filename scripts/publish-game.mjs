// Yeni bir oyunu ya da demo sürümünü ABN Launcher'a yayınlar.
//
//   npm run publish-game -- --id palemouth --ad "PaleMouth" --tur "Psikolojik korku" \
//     --surum 0.3.0 --exe PaleMouth.exe --klasor "D:\Builds\PaleMouth" [--kapak kapak.png]
//
// Ne yapar:
//   1. --klasor verilirse Unity'nin Windows build klasörünü zip'ler (ya da --zip ile hazır zip'i alır).
//   2. Zip'in boyutunu ve sha256'sını hesaplar.
//   3. Zip'i Supabase Storage'a ("launcher" kovası) parça parça yükler. Zip başka yerdeyse
//      (ör. GitHub Releases; ücretsiz Supabase planında dosya sınırı 50 MB) --zip-url ile adresini ver,
//      yükleme atlanır (sha256 için zip dosyası yine de --zip ya da --klasor ile verilmeli).
//   4. Kapak görselini yükler (--kapak).
//   5. games.json'u indirir, bu oyunu ekler/günceller ve geri yükler. Launcher'lar bir sonraki
//      kontrolde (açılışta ya da "Şimdi kontrol et") yeni sürümü görür.
//
// Gerekenler (.env.local içinde, git'e girmez):
//   EXPO_PUBLIC_SUPABASE_URL=https://<proje>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=<Supabase → Project Settings → API → service_role (gizli!)>
//
// Diğer alanlar: --aciklama "..." --durum yayinda|yakinda|beklemede (varsayılan yayinda)
// Sadece listeyi güncellemek (ör. "Yakında" kartı eklemek) için zip vermeden de çalışır.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

// ── ortam ──
for (const f of ['.env.local', '.env']) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE) fail('EXPO_PUBLIC_SUPABASE_URL bulunamadı (.env).');
if (!KEY)
  fail(
    'SUPABASE_SERVICE_ROLE_KEY bulunamadı. Supabase → Project Settings → API → service_role anahtarını .env.local dosyasına ekle.',
  );
const BUCKET = 'launcher';
const publicUrl = (path) => `${URL_BASE}/storage/v1/object/public/${BUCKET}/${path}`;

// ── argümanlar ──
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--'))
    args[a.slice(2)] =
      process.argv[i + 1]?.startsWith('--') || i + 1 >= process.argv.length ? 'true' : process.argv[++i];
}
const id = args.id;
if (!/^[a-z0-9_-]+$/.test(id ?? '')) fail('--id gerekli: küçük harf, rakam ve tire (ör. palemouth).');
const durum = args.durum ?? 'yayinda';
if (!['yayinda', 'yakinda', 'beklemede'].includes(durum))
  fail('--durum yayinda, yakinda ya da beklemede olmalı.');
if (args.surum && !/^\d+\.\d+\.\d+$/.test(args.surum)) fail('--surum 1.2.3 biçiminde olmalı.');

// ── Storage yardımcıları ──
async function upload(path, body, contentType, cacheControl = '60') {
  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${KEY}`,
      apikey: KEY,
      'content-type': contentType,
      'x-upsert': 'true',
      'cache-control': `max-age=${cacheControl}`,
    },
    body,
  });
  if (!res.ok) fail(`Yüklenemedi (${path}): ${res.status} ${await res.text()}`);
}

/** Büyük dosya: TUS ile 6 MB'lık parçalar (koparsa kaldığı yerden sürer). */
function uploadLarge(path, file) {
  const tus = require('tus-js-client');
  const size = statSync(file).size;
  return new Promise((done, reject) => {
    const up = new tus.Upload(createReadStream(file), {
      endpoint: `${URL_BASE}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${KEY}`, apikey: KEY, 'x-upsert': 'true' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      uploadSize: size,
      metadata: {
        bucketName: BUCKET,
        objectName: path,
        contentType: 'application/zip',
        cacheControl: '31536000',
      },
      onError: reject,
      onProgress: (sent, total) =>
        process.stdout.write(`\r  yükleniyor %${Math.floor((sent / total) * 100)}   `),
      onSuccess: () => {
        process.stdout.write('\n');
        done();
      },
    });
    up.start();
  });
}

function sha256(file) {
  return new Promise((done, reject) => {
    const h = createHash('sha256');
    createReadStream(file)
      .on('data', (d) => h.update(d))
      .on('end', () => done(h.digest('hex')))
      .on('error', reject);
  });
}

// ── 1 · zip ──
let zipFile = args.zip ? resolve(args.zip) : null;
let tempZip = false;
if (args.klasor) {
  const dir = resolve(args.klasor);
  if (!existsSync(dir)) fail(`Klasör yok: ${dir}`);
  if (args.exe && !existsSync(join(dir, args.exe)))
    fail(`${args.exe} klasörde yok. --exe build klasöründeki exe'nin adı olmalı.`);
  zipFile = join(tmpdir(), `${id}-${args.surum ?? 'build'}.zip`);
  if (existsSync(zipFile)) unlinkSync(zipFile);
  console.log("1 · Build klasörü zip'leniyor…");
  // Windows'un kendi aracı (PowerShell Compress-Archive); klasörün içeriği zip'in köküne girer.
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${dir.replace(/'/g, "''")}\\*' -DestinationPath '${zipFile.replace(/'/g, "''")}' -CompressionLevel Optimal`,
    ],
    { stdio: 'inherit' },
  );
  tempZip = true;
}

let entry = {};
if (zipFile) {
  if (!existsSync(zipFile)) fail(`Zip yok: ${zipFile}`);
  if (!args.surum) fail('--surum gerekli (ör. 0.3.0).');
  if (!args.exe) fail('--exe gerekli (ör. PaleMouth.exe).');
  const size = statSync(zipFile).size;
  console.log(`2 · sha256 hesaplanıyor (${(size / 1024 ** 2).toFixed(1)} MB)…`);
  const sum = await sha256(zipFile);
  let zipUrl = args['zip-url'];
  if (!zipUrl) {
    const path = `oyunlar/${id}/${id}-${args.surum}.zip`;
    console.log(`3 · Zip yükleniyor → ${BUCKET}/${path}`);
    if (size > 50 * 1024 ** 2)
      console.log(
        "  (50 MB üstü: ücretsiz Supabase planı reddederse zip'i GitHub Releases'a koyup --zip-url ile adresini ver.)",
      );
    await uploadLarge(path, zipFile).catch((e) => fail(`Zip yüklenemedi: ${e.message ?? e}`));
    zipUrl = publicUrl(path);
  } else {
    console.log('3 · Zip yüklemesi atlandı (--zip-url verildi).');
  }
  entry = {
    surum: args.surum,
    zip: zipUrl,
    boyut: size,
    sha256: sum,
    exe: args.exe,
    tarih: new Date().toISOString().slice(0, 10),
  };
  if (tempZip) unlinkSync(zipFile);
}

// ── 4 · kapak ──
if (args.kapak) {
  const file = resolve(args.kapak);
  if (!existsSync(file)) fail(`Kapak yok: ${file}`);
  const ext = extname(file).toLowerCase();
  const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[
    ext
  ];
  if (!type) fail('Kapak png, jpg ya da webp olmalı.');
  const path = `oyunlar/${id}/kapak-${Date.now()}${ext}`;
  console.log(`4 · Kapak yükleniyor (${basename(file)})…`);
  await upload(path, readFileSync(file), type, '31536000');
  entry.kapak = publicUrl(path);
}

// ── 5 · games.json ──
console.log('5 · games.json güncelleniyor…');
const res = await fetch(`${publicUrl('games.json')}?t=${Date.now()}`);
const current = res.ok ? await res.json() : { oyunlar: [] };
const list = Array.isArray(current) ? current : (current.oyunlar ?? []);
const old = list.find((g) => g.id === id) ?? {};
const game = {
  id,
  ad: args.ad ?? old.ad ?? id,
  tur: args.tur ?? old.tur ?? '',
  aciklama: args.aciklama ?? old.aciklama ?? '',
  durum,
  surum: old.surum ?? '0.0.0',
  kapak: old.kapak ?? '',
  zip: old.zip ?? '',
  boyut: old.boyut ?? 0,
  sha256: old.sha256 ?? '',
  exe: old.exe ?? '',
  ...(old.tarih ? { tarih: old.tarih } : {}),
  ...entry,
};
const next = { guncellendi: new Date().toISOString(), oyunlar: [...list.filter((g) => g.id !== id), game] };
await upload('games.json', JSON.stringify(next, null, 2), 'application/json', '60');
console.log(`\n✔ ${game.ad} ${game.surum} (${game.durum}) yayında. Liste: ${publicUrl('games.json')}\n`);
