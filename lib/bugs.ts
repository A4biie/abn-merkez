// Bug takibi (0.11 bölüm 6): buglar, buildler, geçmiş, bug formu deposu.

import { useSyncExternalStore } from 'react';

import type { Message } from './chat';
import { supabase } from './supabase';
import { invalidate, useQuery } from './useQuery';

export type Severity = 'kritik' | 'orta' | 'kucuk';
export type BugStatus = 'yeni' | 'atandi' | 'duzeltildi' | 'test' | 'kapandi';
export type BugAction = 'take' | 'notbug' | 'fix' | 'totest' | 'ok' | 'broken' | 'reopen';

export type Bug = {
  id: string;
  project_id: string | null;
  number: number;
  title: string;
  steps: string[];
  severity: Severity;
  status: BugStatus;
  build_id: string | null;
  fixed_build_id: string | null;
  reporter_id: string | null;
  assignee_id: string | null;
  device: string;
  attachment_path: string | null;
  attachment_kind: 'gorsel' | 'video' | null;
  via: 'web' | 'sohbet' | 'launcher';
  source_message_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};
export type Build = { id: string; project_id: string | null; version: string; notes: string; created_by: string | null; created_at: string };
export type BugEvent = { id: string; bug_id: string; actor_id: string | null; text: string; created_at: string };

export const SEV: Record<Severity, { label: string; color: string }> = {
  kritik: { label: 'Oyunu bozuyor', color: '#ED4245' },
  orta: { label: 'Can sıkıyor', color: '#F0A92E' },
  kucuk: { label: 'Küçük', color: '#80848E' },
};
export const BUG_STATUS: [BugStatus, string][] = [
  ['yeni', 'Yeni'],
  ['atandi', 'Atandı'],
  ['duzeltildi', 'Düzeltildi'],
  ['test', 'Test et'],
  ['kapandi', 'Kapandı'],
];
export const OK = '#3BA55D';
export const code = (b: Pick<Bug, 'number'>) => 'B-' + b.number;

export const useBugs = () =>
  useQuery('bugs', async () => {
    const { data, error } = await supabase.from('bugs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Bug[];
  });
export async function fetchBuilds() {
  const { data, error } = await supabase.from('builds').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Build[];
}
export const useBuilds = () => useQuery('builds', fetchBuilds);
export const useBugEvents = (bugId: string | null) =>
  useQuery(bugId ? `bugEvents:${bugId}` : null, async () => {
    const { data, error } = await supabase.from('bug_events').select('*').eq('bug_id', bugId!).order('created_at');
    if (error) throw error;
    return (data ?? []) as BugEvent[];
  });

export async function reportBug(input: {
  title: string;
  steps: string[];
  severity: Severity;
  buildId: string | null;
  projectId: string | null;
  file: File | null;
  userId: string;
  device: string;
  via?: 'web' | 'launcher';
  message?: Message | null;
}) {
  let path: string | null = null;
  let kind: 'gorsel' | 'video' | null = null;
  if (input.file) {
    const safe = input.file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-60) || 'ekran.png';
    path = `${input.userId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from('bug-files').upload(path, input.file, { contentType: input.file.type });
    if (error) throw error;
    kind = input.file.type.startsWith('video/') ? 'video' : 'gorsel';
  }
  const { data, error } = await supabase.rpc('report_bug', {
    p_title: input.title,
    p_steps: input.steps,
    p_severity: input.severity,
    p_build: input.buildId,
    p_project: input.projectId,
    p_attachment_path: path,
    p_attachment_kind: kind,
    p_device: input.device,
    p_via: input.via ?? 'web',
    p_message: input.message?.id ?? null,
  });
  if (error) throw error;
  invalidate('bugs', 'files');
  return data as string;
}

export async function bugAction(bug: Bug, action: BugAction) {
  const { error } = await supabase.rpc('bug_action', { p_bug: bug.id, p_action: action });
  invalidate('bugs', `bugEvents:${bug.id}`);
  if (error) throw error;
}

export async function createBuild(projectId: string | null, version: string, notes: string) {
  const { error } = await supabase.rpc('create_build', { p_project: projectId, p_version: version, p_notes: notes });
  invalidate('builds', 'bugs');
  if (error) throw error;
}

export async function deleteBug(bug: Bug) {
  const { error } = await supabase.from('bugs').delete().eq('id', bug.id);
  invalidate('bugs');
  if (error) throw error;
}

/** Tarayıcıdan kısa bilgisayar bilgisi: "Windows 11 · Chrome". */
export function deviceInfo(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  const os = /Windows NT 10/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : '';
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).replace(/^ANGLE \((.*)\)$/, '$1').split(',')[1]?.trim() ?? '';
  } catch {
    gpu = '';
  }
  return [os, gpu].filter(Boolean).join(' · ');
}

// ── Bug formu (her yerden açılır: Buglar, Ctrl+K, sohbet mesajı) ──
type FormReq = { message?: Message | null; title?: string; projectId?: string | null };
let form: FormReq | null = null;
const subs = new Set<() => void>();
export function openBugForm(req: FormReq = {}) {
  form = req;
  subs.forEach((f) => f());
}
export function closeBugForm() {
  form = null;
  subs.forEach((f) => f());
}
export function useBugForm() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => form,
    () => null,
  );
}
