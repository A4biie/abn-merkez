// Dosya yükleme yöneticisi (0.7.0). Supabase Storage'ın yeniden başlatılabilir yükleme ucu (TUS)
// kullanılır: gerçek ilerleme olayları gelir, hata olursa "Tekrar dene" kaldığı yerden devam eder.
// Yükleme kartları (components/UploadCard.tsx) bu depodaki işleri gösterir.

import { useSyncExternalStore } from 'react';
import { Upload } from 'tus-js-client';

import { supabase } from './supabase';

export type UploadKind = 'image' | 'video' | 'audio' | 'file';
export type UploadStatus = 'preparing' | 'uploading' | 'done' | 'error' | 'canceled';

export type UploadJob = {
  id: string;
  /** İşin hangi ekrana ait olduğu (ör. pano id); kartlar buna göre süzülür. */
  group: string;
  name: string;
  kind: UploadKind;
  mime: string;
  total: number;
  loaded: number;
  status: UploadStatus;
  /** Görsel ya da videonun küçük resmi (yerel adres). */
  preview: string | null;
  /** Kalan süre (sn); son birkaç saniyedeki hızdan. */
  etaSec: number | null;
  path: string;
};

type Internal = {
  job: UploadJob;
  upload: Upload | null;
  samples: { t: number; loaded: number }[];
  bucket: string;
  body: Blob;
  onDone?: (path: string) => void;
};

const jobs = new Map<string, Internal>();
const listeners = new Set<() => void>();
let snapshot: UploadJob[] = [];

function emit() {
  snapshot = [...jobs.values()].map((j) => j.job);
  listeners.forEach((l) => l());
}

function update(id: string, patch: Partial<UploadJob>) {
  const j = jobs.get(id);
  if (!j) return;
  j.job = { ...j.job, ...patch };
  emit();
}

export function kindOf(mime: string): UploadKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

/** Son 3 saniyedeki hızdan kalan süre. */
function eta(samples: { t: number; loaded: number }[], total: number) {
  const now = samples[samples.length - 1];
  const from = samples.find((s) => now.t - s.t <= 3000) ?? samples[0];
  const dt = (now.t - from.t) / 1000;
  const speed = dt > 0.2 ? (now.loaded - from.loaded) / dt : 0;
  if (speed <= 0) return null;
  return Math.max(0, Math.round((total - now.loaded) / speed));
}

async function begin(id: string) {
  const j = jobs.get(id);
  if (!j) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !base || !anon) {
    update(id, { status: 'error' });
    return;
  }
  // Daha önce başlamış bir yükleme varsa aynı nesne kaldığı yerden devam eder.
  if (!j.upload) {
    j.upload = new Upload(j.body, {
      endpoint: `${base}/storage/v1/upload/resumable`,
      retryDelays: [0, 1500, 4000],
      headers: { authorization: `Bearer ${token}`, apikey: anon, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      // Supabase 6 MB parça ister.
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: j.bucket,
        objectName: j.job.path,
        contentType: j.job.mime,
        cacheControl: '3600',
      },
      onProgress: (loaded, total) => {
        const s = jobs.get(id);
        if (!s) return;
        s.samples.push({ t: Date.now(), loaded });
        if (s.samples.length > 40) s.samples.shift();
        update(id, { status: 'uploading', loaded, total, etaSec: eta(s.samples, total) });
      },
      onError: () => update(id, { status: 'error', etaSec: null }),
      onSuccess: () => {
        const s = jobs.get(id);
        update(id, { status: 'done', loaded: s?.job.total ?? 0, etaSec: 0 });
        s?.onDone?.(s.job.path);
      },
    });
  } else {
    j.upload.options.headers = { ...j.upload.options.headers, authorization: `Bearer ${token}` };
  }
  update(id, { status: 'uploading' });
  j.upload.start();
}

/** Yüklemeyi başlatır; dönüş iş kimliği. onDone yükleme bitince dosya yoluyla çağrılır. */
export function startUpload(input: {
  group: string;
  bucket: string;
  path: string;
  body: Blob;
  name: string;
  mime: string;
  preview?: string | null;
  onDone?: (path: string) => void;
}) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  jobs.set(id, {
    job: {
      id,
      group: input.group,
      name: input.name,
      kind: kindOf(input.mime),
      mime: input.mime,
      total: input.body.size,
      loaded: 0,
      status: 'preparing',
      preview: input.preview ?? null,
      etaSec: null,
      path: input.path,
    },
    upload: null,
    samples: [],
    bucket: input.bucket,
    body: input.body,
    onDone: input.onDone,
  });
  emit();
  begin(id);
  return id;
}

/** Hata sonrası: kaldığı yerden devam eder. */
export function retryUpload(id: string) {
  begin(id);
}

export function cancelUpload(id: string) {
  const j = jobs.get(id);
  if (!j) return;
  j.upload?.abort(true).catch(() => {});
  jobs.delete(id);
  emit();
}

/** Bitmiş ya da iptal edilmiş işleri listeden kaldırır. */
export function clearFinished(group: string) {
  for (const [id, j] of jobs) if (j.job.group === group && j.job.status === 'done') jobs.delete(id);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useUploads(group: string) {
  const all = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
  return all.filter((j) => j.group === group);
}

/** "1.6 / 2.4 MB" gibi. */
export function formatBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
