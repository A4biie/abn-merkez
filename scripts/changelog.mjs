// CHANGELOG.md → lib/changelog.ts. "Neler yeni" paneli bu üretilmiş dosyayı okur.
// Çalıştırmak için: npm run changelog (web derlemesinden önce kendiliğinden çalışır).
//
// Beklenen biçim:
//   ## 0.7.0 · 5 Kasım 2026
//   ### Yeni
//   - madde

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const md = readFileSync(root + 'CHANGELOG.md', 'utf8');

const releases = [];
// ABN Launcher (masaüstü) sürümleri ayrı tutulur: "## Launcher 1.0.1 · 9 Kasım 2026".
const launcherReleases = [];
let release = null;
let section = null;
for (const raw of md.split(/\r?\n/)) {
  const line = raw.trim();
  const lver = /^##\s+Launcher\s+(\d+\.\d+\.\d+)\s*(?:·\s*(.+))?$/.exec(line);
  if (lver) {
    release = { version: lver[1], date: (lver[2] ?? '').trim(), sections: [] };
    launcherReleases.push(release);
    section = null;
    continue;
  }
  const ver = /^##\s+(\d+\.\d+\.\d+)\s*(?:·\s*(.+))?$/.exec(line);
  if (ver) {
    release = { version: ver[1], date: (ver[2] ?? '').trim(), sections: [] };
    releases.push(release);
    section = null;
    continue;
  }
  const sec = /^###\s+(.+)$/.exec(line);
  if (sec && release) {
    section = { title: sec[1].trim(), items: [] };
    release.sections.push(section);
    continue;
  }
  const item = /^-\s+(.+)$/.exec(line);
  if (item && section) section.items.push(item[1].replace(/`/g, ''));
}

const out = `// Bu dosya scripts/changelog.mjs tarafından CHANGELOG.md'den üretilir. Elle düzenleme.

export type Release = { version: string; date: string; sections: { title: string; items: string[] }[] };

export const RELEASES: Release[] = ${JSON.stringify(releases, null, 2)};

/** ABN Launcher (masaüstü) sürümleri. */
export const LAUNCHER_RELEASES: Release[] = ${JSON.stringify(launcherReleases, null, 2)};
`;
writeFileSync(root + 'lib/changelog.ts', out);
console.log(`lib/changelog.ts: ${releases.length} Merkez, ${launcherReleases.length} Launcher sürümü`);
