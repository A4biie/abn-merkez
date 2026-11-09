import { useMemo } from 'react';

import { useAuth } from './auth';
import { dative } from './labels';
import { useProfiles, useProjects, useRequests } from './queries';
import type { Profile, Project, Task, TeamRequest } from './types';

/** Ekip, projeler ve isteklerden türetilen yardımcılar. Ekranlar arasında ortak. */
export function useTeam() {
  const { profile: me } = useAuth();
  const profiles = useProfiles();
  const projects = useProjects();
  const requests = useRequests();

  return useMemo(() => {
    const people = new Map<string, Profile>((profiles.data ?? []).map((p) => [p.id, p]));
    const projectMap = new Map<string, Project>((projects.data ?? []).map((p) => [p.id, p]));
    const meId = me?.id ?? '';
    const isAdmin = !!me?.is_admin;
    const firstAdmin = (profiles.data ?? []).find((p) => p.is_admin && p.full_name)?.full_name ?? 'yönetici';

    const person = (id: string | null | undefined) => (id ? people.get(id) : undefined);
    const nameOf = (id: string | null | undefined) => person(id)?.full_name ?? 'Biri';
    const isMember = (projectId: string) => !!projectMap.get(projectId)?.members.includes(meId);

    const myPending = (requests.data ?? []).filter((r) => r.requester_id === meId && r.status === 'bekliyor');
    const pendingFor = (task: Task) =>
      myPending.some((r) =>
        task.project_id ? r.kind === 'proje' && r.project_id === task.project_id : r.kind === 'gorev' && r.task_id === task.id,
      );
    const joinPending = (projectId: string) => myPending.some((r) => r.kind === 'proje' && r.project_id === projectId);

    /** claim_task ile aynı kural; sadece kilit simgesini önceden göstermek için. */
    const canClaim = (task: Task) => {
      if (!me) return false;
      if (isAdmin) return true;
      if (task.project_id && !isMember(task.project_id)) return false;
      if (task.lock_type === 'rol') return task.lock_roles.includes(me.role_title);
      if (task.lock_type === 'kisi') return task.lock_people.includes(meId);
      if (task.lock_type === 'admin') return false;
      return true;
    };

    /** Kilitli görevin kartındaki kısa açıklama (prototipteki lockHint). */
    const lockHint = (task: Task) => {
      if (task.project_id && !isMember(task.project_id)) {
        return `${projectMap.get(task.project_id)?.name ?? 'Bu proje'} ekibine özel`;
      }
      if (task.lock_type === 'rol') {
        return task.lock_roles.length
          ? `Sadece ${task.lock_roles.join(', ').toLocaleLowerCase('tr')} rolündekiler alabilir`
          : 'Henüz kimseye açılmadı';
      }
      if (task.lock_type === 'kisi') return 'Belirli kişilere ayrıldı';
      return `${firstAdmin} atıyor`;
    };

    const leadName = (projectId: string) => nameOf(projectMap.get(projectId)?.lead_id);

    const requestText = (r: TeamRequest, taskTitle?: string) =>
      r.kind === 'proje'
        ? `${nameOf(r.requester_id)}, ${projectMap.get(r.project_id ?? '')?.name ?? 'bir'} projesine katılmak istiyor`
        : `${nameOf(r.requester_id)}, “${taskTitle ?? 'bir'}” görevini almak istiyor`;

    return {
      me,
      meId,
      isAdmin,
      people,
      projects: projects.data ?? [],
      projectMap,
      requests: requests.data ?? [],
      loading: profiles.loading || projects.loading,
      error: profiles.error ?? projects.error,
      refetch: () => Promise.all([profiles.refetch(), projects.refetch(), requests.refetch()]),
      person,
      nameOf,
      isMember,
      canClaim,
      lockHint,
      pendingFor,
      joinPending,
      leadName,
      leadDative: (projectId: string) => dative(leadName(projectId)),
      requestText,
      firstAdmin,
    };
  }, [me, profiles, projects, requests]);
}

/** Kalp metni: "Rüzgar ve Mert beğendi", "Sen beğendin" (prototipteki likeInfo). */
export function likeInfo(hearts: { user_id: string }[], meId: string, nameOf: (id: string) => string) {
  const liked = hearts.some((h) => h.user_id === meId);
  const ids = liked ? [meId, ...hearts.map((h) => h.user_id).filter((id) => id !== meId)] : hearts.map((h) => h.user_id);
  const names = ids.map((id) => (id === meId ? 'Sen' : nameOf(id)));
  let text = '';
  if (names.length === 1) text = liked ? 'Sen beğendin' : `${names[0]} beğendi`;
  else if (names.length === 2) text = `${names[0]} ve ${names[1]}${liked ? ' beğendiniz' : ' beğendi'}`;
  else if (names.length > 2) text = `${names[0]}, ${names[1]} ve diğerleri${liked ? ' beğendiniz' : ' beğendi'}`;
  return { liked, ids, text };
}
