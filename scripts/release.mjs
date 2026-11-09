// ABN Launcher sürümü çıkarır: npm run release 1.0.1
//  1. src-tauri/tauri.conf.json ve src-tauri/Cargo.toml'daki Launcher sürümünü yükseltir
//     (Merkez'in sürümü app.json'da, ona dokunmaz).
//  2. CHANGELOG.md'ye "## Launcher 1.0.1 · tarih" bölümünü ekler (son etiketten beri commit başlıkları).
//  3. Commit atar, v1.0.1 etiketini koyar ve ikisini de GitHub'a gönderir.
// Etiket gidince .github/workflows/desktop.yml Windows kurulumunu derleyip GitHub Releases'a yükler.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sh = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next ?? '')) fail('Sürümü yaz: npm run release 1.0.1');

const confPath = root + 'src-tauri/tauri.conf.json';
const cargoPath = root + 'src-tauri/Cargo.toml';
const conf = JSON.parse(readFileSync(confPath, 'utf8'));
const current = conf.version;

const tags = sh('git tag --list "v*"').split('\n').filter(Boolean);
if (tags.includes(`v${next}`)) fail(`v${next} etiketi zaten var. Daha yüksek bir sürüm yaz.`);
const cmp = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
// İlk sürümde (hiç etiket yokken) mevcut sürümle aynı numara da olur: npm run release 1.0.0
if (cmp(next, current) < 0 || (cmp(next, current) === 0 && tags.length > 0)) {
  fail(`Yeni sürüm (${next}) şimdikinden (${current}) büyük olmalı.`);
}

let remote = '';
try {
  remote = sh('git remote get-url origin');
} catch {
  fail(
    'Bu klasörün bir GitHub deposu yok. Önce README\'deki "İlk kurulum" adımlarını yap (git remote add origin ...).',
  );
}

// 1 · sürüm
conf.version = next;
writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');
const cargo = readFileSync(cargoPath, 'utf8').replace(/^version = "[^"]+"/m, `version = "${next}"`);
writeFileSync(cargoPath, cargo);

// 2 · CHANGELOG: son etiketten bu yana commit başlıkları; yoksa kısa bir not.
const months = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];
const d = new Date();
const date = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
const last = tags.sort((a, b) => cmp(b.slice(1), a.slice(1)))[0];
let subjects = [];
try {
  subjects = sh(last ? `git log ${last}..HEAD --pretty=%s` : 'git log --pretty=%s')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !/^Launcher \d/.test(s));
} catch {
  subjects = []; // henüz hiç commit yok
}
const items = subjects.length
  ? subjects
  : [last ? 'Düzeltmeler ve iyileştirmeler.' : 'İlk sürüm: ABN Merkez masaüstünde.'];
const block = `## Launcher ${next} · ${date}\n\n### Yeni\n\n${items.map((s) => `- ${s}`).join('\n')}\n\n`;
const mdPath = root + 'CHANGELOG.md';
const md = readFileSync(mdPath, 'utf8');
// Bu sürümün bölümü önceden elle yazıldıysa korunur, sadece başlığa tarih konur.
const own = new RegExp(`^## Launcher ${next.replace(/\./g, '\\.')}\\b.*$`, 'm');
if (own.test(md)) {
  writeFileSync(mdPath, md.replace(own, `## Launcher ${next} · ${date}`));
} else {
  const at = md.indexOf('\n## ');
  writeFileSync(mdPath, at < 0 ? md + '\n' + block : md.slice(0, at + 1) + block + md.slice(at + 1));
}
sh('node scripts/changelog.mjs');

// 3 · commit, etiket, gönder
sh('git add -A');
sh(`git commit -m "Launcher ${next}"`);
sh(`git tag -a v${next} -m "ABN Launcher ${next}"`);
console.log(`\nLauncher ${current} → ${next}. GitHub'a gönderiliyor (${remote})…`);
execSync('git push origin HEAD', { cwd: root, stdio: 'inherit' });
execSync(`git push origin v${next}`, { cwd: root, stdio: 'inherit' });
const web = remote.replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
console.log(`\n✔ v${next} gönderildi. Derlemeyi buradan izle: ${web}/actions\n`);
