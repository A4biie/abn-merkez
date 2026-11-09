// ABN oyunları: liste Supabase Storage'daki herkese açık games.json'dan gelir (bkz. scripts/publish-game.mjs).
// Kurulum, indirme ve başlatma Rust tarafında yapılır (src-tauri/src/games.rs); ilerleme olay olarak gelir.
// Tarayıcıda (?launcher) gerçek indirme yok: örnek oyunlar ve taklit indirme gösterilir.

import { invoke, isDesktop, launcherDemo, listenDesktop } from '@/lib/desktop';
import { useQuery } from '@/lib/useQuery';

import { getSettings } from './settings';
import { createStore, useStore } from './store';

export type GameStatus = 'yayinda' | 'yakinda' | 'beklemede';

/** games.json'daki bir oyun. */
export type Game = {
  id: string;
  ad: string;
  tur: string;
  aciklama: string;
  durum: GameStatus;
  surum: string;
  kapak: string;
  zip: string;
  /** Zip boyutu, bayt. */
  boyut: number;
  sha256: string;
  /** Kurulum klasörüne göre çalıştırılacak exe, ör. "PaleMouth.exe". */
  exe: string;
  /** Sürümün yayınlandığı gün (ISO), haberler sütunu için. */
  tarih?: string;
};

export type Installed = { version: string; dir: string };

export type DownloadPhase = 'indiriliyor' | 'duraklatildi' | 'dogrulaniyor' | 'cikariliyor' | 'hata';
export type Download = {
  id: string;
  name: string;
  version: string;
  phase: DownloadPhase;
  received: number;
  total: number;
  /** bayt/sn */
  speed: number;
  error?: string;
};

type State = {
  installed: Record<string, Installed>;
  downloads: Record<string, Download>;
  playing: string | null;
};

const store = createStore<State>({ installed: {}, downloads: {}, playing: null });
export const useGameState = () => useStore(store);

export const GAMES_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/launcher/games.json`;

async function fetchGames(): Promise<Game[]> {
  if (launcherDemo) return DEMO_GAMES;
  const res = await fetch(`${GAMES_URL}?t=${Date.now()}`);
  if (res.status === 400 || res.status === 404) return []; // henüz hiç oyun yayınlanmadı
  if (!res.ok) throw new Error('Oyun listesi alınamadı.');
  const data = (await res.json()) as { oyunlar?: Game[] } | Game[];
  return Array.isArray(data) ? data : (data.oyunlar ?? []);
}

export const useGames = () => useQuery('launcher-games', fetchGames);

/** a < b mi? (1.2.0 < 1.10.0) */
export function olderThan(a: string, b: string) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d < 0;
  }
  return false;
}

/** Kartta ne gösterileceği. */
export type GameAction =
  'indir' | 'guncelle' | 'oyna' | 'oynaniyor' | 'yakinda' | 'beklemede' | 'indiriliyor';

export function gameAction(g: Game, s: State): GameAction {
  if (s.downloads[g.id]) return 'indiriliyor';
  if (s.playing === g.id) return 'oynaniyor';
  const inst = s.installed[g.id];
  if (inst) return olderThan(inst.version, g.surum) && g.durum === 'yayinda' ? 'guncelle' : 'oyna';
  if (g.durum === 'yakinda') return 'yakinda';
  if (g.durum === 'beklemede') return 'beklemede';
  return 'indir';
}

export function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// ── Eylemler ──

export async function loadInstalled() {
  if (!isDesktop) return;
  const installed = await invoke<Record<string, Installed>>('games_installed', {
    installDir: getSettings().installDir,
  }).catch(() => ({}));
  store.set((s) => ({ ...s, installed }));
}

export async function installGame(g: Game) {
  store.set((s) => ({
    ...s,
    downloads: {
      ...s.downloads,
      [g.id]: {
        id: g.id,
        name: g.ad,
        version: g.surum,
        phase: 'indiriliyor',
        received: 0,
        total: g.boyut,
        speed: 0,
      },
    },
  }));
  if (launcherDemo) return demoDownload(g);
  try {
    await invoke('game_install', { game: g, installDir: getSettings().installDir });
  } catch (e) {
    patch(g.id, { phase: 'hata', error: String(e) });
  }
}

/** Ayarlarda otomatik güncelleme açıksa, kurulu ve yeni sürümü çıkmış oyunları indirir. */
export function autoUpdateGames(games: Game[]) {
  if (!getSettings().autoUpdate || launcherDemo) return;
  const s = store.get();
  for (const g of games) if (gameAction(g, s) === 'guncelle') void installGame(g);
}

export async function pauseGame(id: string) {
  patch(id, { phase: 'duraklatildi', speed: 0 });
  if (isDesktop) await invoke('game_pause', { id }).catch(() => {});
}

export async function resumeGame(g: Game) {
  patch(g.id, { phase: 'indiriliyor', error: undefined });
  if (launcherDemo) return demoDownload(g);
  if (isDesktop)
    await invoke('game_install', { game: g, installDir: getSettings().installDir }).catch((e) =>
      patch(g.id, { phase: 'hata', error: String(e) }),
    );
}

export async function cancelGame(id: string) {
  dropDownload(id);
  if (isDesktop) await invoke('game_cancel', { id, installDir: getSettings().installDir }).catch(() => {});
}

export async function uninstallGame(id: string) {
  if (isDesktop) await invoke('game_uninstall', { id, installDir: getSettings().installDir });
  store.set((s) => {
    const installed = { ...s.installed };
    delete installed[id];
    return { ...s, installed };
  });
}

/** Kurulu dosyaları games.json'daki sha256 ile değil, kurulumda kaydedilen dosya listesiyle denetler. */
export async function verifyGame(id: string): Promise<boolean> {
  if (!isDesktop) return true;
  return invoke<boolean>('game_verify', { id, installDir: getSettings().installDir });
}

export async function openGameFolder(id: string) {
  const dir = store.get().installed[id]?.dir;
  if (!isDesktop || !dir) return;
  const { openPath } = await import('@tauri-apps/plugin-opener');
  await openPath(dir);
}

export async function playGame(g: Game) {
  store.set((s) => ({ ...s, playing: g.id }));
  if (launcherDemo) return void setTimeout(() => store.set((s) => ({ ...s, playing: null })), 4000);
  try {
    await invoke('game_play', { id: g.id, exe: g.exe, installDir: getSettings().installDir });
  } catch (e) {
    store.set((s) => ({ ...s, playing: null }));
    throw e;
  }
}

function patch(id: string, p: Partial<Download>) {
  store.set((s) =>
    s.downloads[id] ? { ...s, downloads: { ...s.downloads, [id]: { ...s.downloads[id], ...p } } } : s,
  );
}

function dropDownload(id: string) {
  store.set((s) => {
    const downloads = { ...s.downloads };
    delete downloads[id];
    return { ...s, downloads };
  });
}

function finishInstall(id: string, version: string, dir: string) {
  dropDownload(id);
  store.set((s) => ({ ...s, installed: { ...s.installed, [id]: { version, dir } } }));
}

// Rust'tan gelen ilerleme olayları (src-tauri/src/games.rs).
type ProgressEvent = {
  id: string;
  phase: DownloadPhase | 'bitti';
  received: number;
  total: number;
  speed: number;
  version?: string;
  dir?: string;
  error?: string;
};
listenDesktop<ProgressEvent>('game://progress', (e) => {
  if (e.phase === 'bitti') finishInstall(e.id, e.version ?? '', e.dir ?? '');
  else
    patch(e.id, {
      phase: e.phase,
      received: e.received,
      total: e.total || store.get().downloads[e.id]?.total || 0,
      speed: e.speed,
      error: e.error,
    });
});
listenDesktop<{ id: string }>('game://exited', () => store.set((s) => ({ ...s, playing: null })));

// ── Tarayıcı denemesi ──

function demoDownload(g: Game) {
  const iv = setInterval(() => {
    const d = store.get().downloads[g.id];
    if (!d || d.phase !== 'indiriliyor') return clearInterval(iv);
    const speed = (14 + Math.random() * 10) * 1024 ** 2;
    const received = Math.min(d.total, d.received + speed * 0.25);
    patch(g.id, { received, speed });
    if (received >= d.total) {
      clearInterval(iv);
      patch(g.id, { phase: 'dogrulaniyor', speed: 0 });
      setTimeout(() => patch(g.id, { phase: 'cikariliyor' }), 900);
      setTimeout(() => finishInstall(g.id, g.surum, `${getSettings().installDir}\\${g.id}`), 1900);
    }
  }, 250);
}

const DEMO_GAMES: Game[] = [
  {
    id: 'palemouth',
    ad: 'PaleMouth',
    tur: 'Psikolojik korku · görsel roman',
    aciklama: 'Sessiz bir kasabada, kimsenin hatırlamadığı bir ses.',
    durum: 'yayinda',
    surum: '0.3.0',
    kapak: '',
    zip: '',
    boyut: 412 * 1024 ** 2,
    sha256: '',
    exe: 'PaleMouth.exe',
    tarih: '2026-11-07',
  },
  {
    id: 'dedektif-antolojisi',
    ad: 'Dedektif Antolojisi',
    tur: 'Gizem · bölüm bölüm',
    aciklama: 'Her hikâyede ayrı bir dedektif, ortak bir şehir.',
    durum: 'yakinda',
    surum: '0.1.0',
    kapak: '',
    zip: '',
    boyut: 0,
    sha256: '',
    exe: '',
  },
  {
    id: 'gumruk',
    ad: 'Gümrük Oyunu',
    tur: 'Simülasyon · hikâye',
    aciklama: 'Bir sınır kapısında, her bavulun bir hikâyesi var.',
    durum: 'beklemede',
    surum: '0.0.4',
    kapak: '',
    zip: '',
    boyut: 0,
    sha256: '',
    exe: '',
  },
];
