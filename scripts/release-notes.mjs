// CHANGELOG.md'den bir Launcher sürümünün notlarını yazdırır (GitHub Release metni ve güncelleme notu için).
// Kullanım: node scripts/release-notes.mjs v1.0.1

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const version = (process.argv[2] ?? '').replace(/^v/, '');
const md = readFileSync(fileURLToPath(new URL('../CHANGELOG.md', import.meta.url)), 'utf8');
const lines = md.split(/\r?\n/);
const start = lines.findIndex((l) =>
  new RegExp(`^##\\s+Launcher\\s+${version.replace(/\./g, '\\.')}\\b`).test(l),
);
if (start < 0) {
  console.log(`ABN Launcher ${version}`);
} else {
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  console.log(
    lines
      .slice(start + 1, end < 0 ? undefined : end)
      .join('\n')
      .trim(),
  );
}
