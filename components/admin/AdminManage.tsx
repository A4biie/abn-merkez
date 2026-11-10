import { openProfile } from '@/lib/profileModal';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';

import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Button, Card, Field } from '@/components/ui/Controls';
import { SkeletonCards } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Select, Switch } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { friendlyError } from '@/lib/errors';
import { AVAILABILITY, PROJECT_STATUS } from '@/lib/labels';
import {
  addMilestone,
  createProject,
  adminUpdateProfile,
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementPinned,
  setMilestoneDone,
  setProfitShare,
  setProjectMember,
  setTaskLock,
  updateProject,
  useAnnouncements,
  useProfitShares,
  useTasks,
} from '@/lib/queries';
import { useTeam } from '@/lib/team';
import { timeAgo } from '@/lib/time';
import type { LockType, Profile, Project, ProjectStatus, Task } from '@/lib/types';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { LoginSheet, NewMemberSheet } from './AdminLogins';
import { TableRow } from './TableRow';

// Desktop.dc.html ROLES
const ROLES = ['ABN Temsilcisi', 'Çizer', 'Video editörü', 'Yazar', 'Ses tasarımcısı', 'Programcı'];

function useSay() {
  const say = useToast();
  return (error: unknown, ok?: string) => {
    if (error) say(friendlyError(error));
    else if (ok) say(ok);
  };
}

// ───────────────────────── Üyeler ─────────────────────────

export function AdminMembers() {
  const team = useTeam();
  const tasks = useTasks();
  const people = [...team.people.values()];
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const W = [190, 190, 220, 150, 120, 110, 100, 190];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Txt size={14} color="muted" style={{ flex: 1, minWidth: 240 }}>
          Rol değişikliği görev kilitlerini de etkiler. Örneğin birini Çizer yaparsan sadece çizerlere açık görevleri alabilir.
        </Txt>
        <Button label="Yeni üye" icon="plus" size="sm" onPress={() => setAdding(true)} />
      </View>
      <Card radius={24} padding={0} gap={0} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <TableRow
              header
              first
              cells={['Kişi', 'Rol', 'Projeler', 'Durum', 'Kâr payı', 'Biten / Açık', 'Yönetici', ''].map((h, i) => ({ w: W[i], node: h }))}
            />
            {people.map((p) => (
              <MemberRow key={p.id} person={p} widths={W} tasks={tasks.data ?? []} onLogin={() => setEditing(p)} />
            ))}
          </View>
        </ScrollView>
      </Card>
      <NewMemberSheet open={adding} onClose={() => setAdding(false)} />
      <LoginSheet person={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function MemberRow({ person, widths: W, tasks, onLogin }: { person: Profile; widths: number[]; tasks: Task[]; onLogin: () => void }) {
  const { colors } = useTheme();
  const team = useTeam();
  const shares = useProfitShares();
  const report = useSay();
  const rate = shares.data?.[person.id];
  const [draft, setDraft] = useState<string | null>(null);
  const projects = team.projects.filter((pr) => pr.members.includes(person.id)).map((pr) => pr.name);
  const mine = tasks.filter((t) => t.assignee_id === person.id);
  const done = mine.filter((t) => t.status === 'bitti').length;
  const avail = AVAILABILITY[person.availability];
  const roles = ROLES.includes(person.role_title) || !person.role_title ? ROLES : [person.role_title, ...ROLES];

  async function saveShare() {
    if (draft === null) return;
    const v = draft.replace(',', '.').trim();
    const num = v === '' ? null : Math.max(0, Math.min(100, Number(v)));
    setDraft(null);
    if (num !== null && Number.isNaN(num)) return;
    report(await setProfitShare(person.id, num));
  }

  return (
    <TableRow
      cells={[
        {
          w: W[0],
          node: (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar person={person} size={34} />
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Txt weight={700} numberOfLines={1}>
                  {person.full_name}
                </Txt>
                <Txt size={12.5} color="muted" numberOfLines={1}>
                  @{person.username}
                </Txt>
              </View>
            </View>
          ),
        },
        {
          w: W[1],
          node: (
            <Select
              label={`${person.full_name} için rol`}
              value={person.role_title}
              options={roles.map((r) => ({ value: r, label: r }))}
              onChange={async (r) => report(await adminUpdateProfile(person.id, { role_title: r }), `${person.full_name} artık ${r}`)}
              minWidth={170}
            />
          ),
        },
        {
          w: W[2],
          node: (
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
              {projects.map((n) => (
                <Box key={n} bg="surface2" style={{ borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
                  <Txt size={12} weight={600} color="text-2" leading={1.3}>
                    {n}
                  </Txt>
                </Box>
              ))}
            </View>
          ),
        },
        {
          w: W[3],
          node: (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: avail.color }} />
              <Txt size={13.5}>{avail.label}</Txt>
            </View>
          ),
        },
        {
          w: W[4],
          node: (
            <Box bg="surface2" border="line-2" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 10 }}>
              <Txt color="muted">%</Txt>
              <TextInput
                value={draft ?? (rate == null ? '' : String(rate))}
                onChangeText={setDraft}
                onBlur={saveShare}
                onSubmitEditing={saveShare}
                placeholder="—"
                placeholderTextColor={colors.faint}
                inputMode="decimal"
                aria-label={`${person.full_name} kâr payı`}
                style={{ width: 54, color: colors.text, fontFamily: fontFamily(400), fontSize: 14, paddingVertical: 7 }}
              />
            </Box>
          ),
        },
        {
          w: W[5],
          node: (
            <Txt style={{ fontVariant: ['tabular-nums'] }}>
              {done} / {mine.length - done}
            </Txt>
          ),
        },
        {
          w: W[6],
          node: (
            <Switch
              label={`${person.full_name} yönetici`}
              value={person.is_admin}
              onChange={async (v) => report(await adminUpdateProfile(person.id, { is_admin: v }), v ? `${person.full_name} artık yönetici` : 'Yöneticilik kaldırıldı')}
            />
          ),
        },
        {
          w: W[7],
          right: true,
          node: (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Button label="Giriş" icon="lock" size="sm" kind="soft" onPress={onLogin} accessibilityLabel={`${person.full_name} giriş bilgisi`} />
              <Button label="Profil" size="sm" kind="soft" onPress={() => openProfile(person.id)} />
            </View>
          ),
        },
      ]}
    />
  );
}

// ───────────────────────── Projeler ─────────────────────────

export function AdminProjects() {
  const team = useTeam();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
      {team.projects.map((p) => (
        <ProjectAdmin key={p.id} project={p} />
      ))}
      <NewProject />
    </View>
  );
}

function NewProject() {
  const report = useSay();
  const team = useTeam();
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    const n = name.trim();
    if (!n) return report(null, 'Projenin bir adı olsun');
    if (!team.meId) return;
    setBusy(true);
    const e = await createProject(n, summary.trim(), team.meId);
    setBusy(false);
    report(e, `${n} açıldı. Ekibi ve kilometre taşlarını buradan ekleyebilirsin.`);
    if (!e) {
      setName('');
      setSummary('');
    }
  }

  return (
    <Card radius={24} padding={20} gap={12} style={{ flexGrow: 1, flexBasis: 380, maxWidth: 640 }}>
      <Txt size={18} weight={700}>
        Yeni proje
      </Txt>
      {team.projects.length === 0 && <Txt color="muted">Henüz proje yok. İlkini buradan aç; proje yöneticisi sen olursun.</Txt>}
      <Field label="Proje adı" value={name} onChangeText={setName} placeholder="Proje adı" style={{ borderRadius: 12 }} />
      <Field label="Kısa açıklama" value={summary} onChangeText={setSummary} placeholder="Kısa açıklama (isteğe bağlı)" style={{ borderRadius: 12 }} />
      <Button label={busy ? 'Açılıyor…' : 'Projeyi aç'} icon="plus" onPress={create} disabled={busy} />
    </Card>
  );
}

function ProjectAdmin({ project: p }: { project: Project }) {
  const { colors } = useTheme();
  const say = useToast();
  const report = useSay();
  const team = useTeam();
  const [ms, setMs] = useState('');
  const members = p.members.map((id) => team.person(id)).filter((x) => !!x);
  const addable = [...team.people.values()].filter((x) => !p.members.includes(x.id));

  async function remove(id: string) {
    if (id === p.lead_id) {
      say('Proje yöneticisini çıkarmadan önce başka birini yönetici yap');
      return;
    }
    report(await setProjectMember(p.id, id, false), `${team.nameOf(id)} projeden çıkarıldı`);
  }

  async function addMs() {
    const t = ms.trim();
    if (!t) return;
    setMs('');
    report(await addMilestone(p.id, t, p.milestones.length + 1));
  }

  return (
    <Card radius={24} padding={20} gap={14} style={{ flexGrow: 1, flexBasis: 380, maxWidth: 640 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt size={20} weight={700} style={{ flex: 1 }}>
          {p.name}
        </Txt>
        <Txt size={13} weight={700} style={{ fontVariant: ['tabular-nums'] }}>
          %{p.progress}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 150, gap: 4 }}>
          <Txt size={12.5} color="muted">
            Durum
          </Txt>
          <Select
            label={`${p.name} durumu`}
            value={p.status}
            options={(Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((k) => ({ value: k, label: PROJECT_STATUS[k].label }))}
            onChange={async (v) => report(await updateProject(p.id, { status: v }), 'Proje durumu güncellendi')}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150, gap: 4 }}>
          <Txt size={12.5} color="muted">
            Proje yöneticisi
          </Txt>
          <Select
            label={`${p.name} proje yöneticisi`}
            value={p.lead_id ?? ''}
            options={[...team.people.values()].map((x) => ({ value: x.id, label: x.full_name }))}
            onChange={async (v) => report(await updateProject(p.id, { lead_id: v }), `${team.nameOf(v)} artık proje yöneticisi`)}
          />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Txt size={12.5} color="muted">
          Ekip
        </Txt>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {members.map((m) => (
            <Box key={m.id} bg="surface2" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, padding: 4 }}>
              <Avatar person={m} size={24} />
              <Txt size={13} weight={600}>
                {m.full_name}
              </Txt>
              <Press
                onPress={() => remove(m.id)}
                accessibilityLabel={`${m.full_name} projeden çıkar`}
                bg="chip"
                style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="close" size={12} color={colors.text} strokeWidth={2.4} />
              </Press>
            </Box>
          ))}
          {addable.map((x) => (
            <Press
              key={x.id}
              onPress={async () => report(await setProjectMember(p.id, x.id, true), `${x.full_name} projeye eklendi`)}
              hoverBg="hover"
              style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: colors['line-2'], borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 }}
            >
              <Txt size={13} weight={600} color="muted">
                + {x.full_name}
              </Txt>
            </Press>
          ))}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Txt size={12.5} color="muted">
          Kilometre taşları
        </Txt>
        {p.milestones.map((m) => (
          <Press
            key={m.id}
            onPress={async () => report(await setMilestoneDone(m.id, !m.done))}
            role="checkbox"
            accessibilityState={{ checked: m.done }}
            hoverBg="hover"
            style={{ borderRadius: 10, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: m.done ? colors.bar : colors['line-2'],
                backgroundColor: m.done ? colors.a1 : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {m.done && <Icon name="check" size={12} color={colors['a1-ink']} strokeWidth={3.4} />}
            </View>
            <Txt size={14.5} color={m.done ? 'muted' : 'text'}>
              {m.title}
            </Txt>
          </Press>
        ))}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Field
            label="Yeni adım"
            value={ms}
            onChangeText={setMs}
            onSubmitEditing={addMs}
            placeholder="Yeni adım ekle…"
            style={{ flex: 1, minWidth: 0, borderRadius: 10, paddingVertical: 8, fontSize: 14 }}
          />
          <Button label="Ekle" kind="accent" onPress={addMs} style={{ borderRadius: 10 }} />
        </View>
      </View>
    </Card>
  );
}

// ───────────────────────── Görev kilitleri ─────────────────────────

const LOCK_OPTS: [LockType, string][] = [
  ['yok', 'Herkese açık'],
  ['rol', 'Rol'],
  ['kisi', 'Kişi'],
  ['admin', 'Sadece ben atarım'],
];

export function AdminLocks() {
  const tasks = useTasks();
  const team = useTeam();
  const report = useSay();
  if (tasks.loading) return <SkeletonCards count={2} lines={1} />;
  const rows = (tasks.data ?? []).filter((t) => !t.project_id && t.status !== 'bitti');
  // Kilit listesinde gösterilecek kişiler: yöneticiler zaten her görevi alabilir.
  const candidates = [...team.people.values()].filter((p) => !p.is_admin);

  const summary = (t: Task) => {
    if (t.lock_type === 'yok') return 'Herkes havuzdan alabilir.';
    if (t.lock_type === 'rol')
      return t.lock_roles.length ? `Sadece ${t.lock_roles.join(', ')} rolündekiler alabilir.` : 'Henüz rol seçilmedi, şu an kimse alamaz.';
    if (t.lock_type === 'kisi')
      return t.lock_people.length
        ? `Sadece ${t.lock_people.map((id) => team.nameOf(id)).join(', ')} alabilir.`
        : 'Henüz kişi seçilmedi, şu an kimse alamaz.';
    return 'Havuzda görünür ama sadece sen atayabilirsin. İsteyen istek gönderir.';
  };

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Press key={label} onPress={onPress} bg={on ? 'a2' : 'surface2'} accessibilityState={{ selected: on }} style={{ borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
      <Txt size={13} weight={600} color={on ? 'a2-ink' : 'text-2'}>
        {label}
      </Txt>
    </Press>
  );

  return (
    <View style={{ gap: 12 }}>
      <Txt size={14} color="muted">
        Proje görevleri otomatik olarak o projenin ekibine açıktır. Burada projesiz görevlerin kimlere açık olacağını seçersin.
      </Txt>
      {rows.length === 0 && (
        <EmptyState title="Kilitlenecek görev yok" description="Açık ve projesiz bir görev olunca kilidini buradan seçersin." />
      )}
      {rows.map((t) => (
        <Card key={t.id} radius={20} padding={16} gap={12} style={{ paddingHorizontal: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Txt weight={700}>{t.title}</Txt>
              <Txt size={13} color="muted">
                {t.assignee_id ? `${team.nameOf(t.assignee_id)}’da` : 'Havuzda'} · {t.due_label}
              </Txt>
            </View>
            <Box bg="surface2" style={{ flexDirection: 'row', gap: 3, borderRadius: 999, padding: 3, flexWrap: 'wrap' }}>
              {LOCK_OPTS.map(([k, label]) => (
                <Press
                  key={k}
                  onPress={async () => t.lock_type !== k && report(await setTaskLock(t.id, { lock_type: k }))}
                  bg={t.lock_type === k ? 'sel-bg' : undefined}
                  accessibilityState={{ selected: t.lock_type === k }}
                  style={{ borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 }}
                >
                  <Txt size={13} weight={600} color={t.lock_type === k ? 'sel-fg' : 'text-2'}>
                    {label}
                  </Txt>
                </Press>
              ))}
            </Box>
          </View>
          {t.lock_type === 'rol' && (
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Txt size={13} color="muted">
                Alabilecek roller:
              </Txt>
              {ROLES.filter((r) => r !== 'ABN Temsilcisi').map((r) => {
                const on = t.lock_roles.includes(r);
                return chip(r, on, async () =>
                  report(await setTaskLock(t.id, { lock_roles: on ? t.lock_roles.filter((x) => x !== r) : [...t.lock_roles, r] })),
                );
              })}
            </View>
          )}
          {t.lock_type === 'kisi' && (
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Txt size={13} color="muted">
                Alabilecek kişiler:
              </Txt>
              {candidates.map((p) => {
                const on = t.lock_people.includes(p.id);
                return chip(p.full_name, on, async () =>
                  report(await setTaskLock(t.id, { lock_people: on ? t.lock_people.filter((x) => x !== p.id) : [...t.lock_people, p.id] })),
                );
              })}
            </View>
          )}
          <Txt size={13} color="text-3">
            {summary(t)}
          </Txt>
        </Card>
      ))}
    </View>
  );
}

// ───────────────────────── Duyurular ─────────────────────────

export function AdminAnnouncements({ draft }: { draft?: { title: string; body: string } }) {
  const { colors } = useTheme();
  const report = useSay();
  const anns = useAnnouncements();
  const [title, setTitle] = useState(draft?.title ?? '');
  const [body, setBody] = useState(draft?.body ?? '');
  const [pin, setPin] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function publish() {
    if (!title.trim()) {
      report(null, 'Duyurunun bir başlığı olsun');
      return;
    }
    setBusy(true);
    const e = await createAnnouncement(title.trim(), body.trim(), pin);
    setBusy(false);
    report(e, pin ? 'Yayınlandı, ekibe bildirim gitti' : 'Yayınlandı');
    if (!e) {
      setTitle('');
      setBody('');
      setPin(false);
    }
  }

  return (
    <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <Card radius={24} padding={20} gap={12} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 340, maxWidth: 440 }}>
        <Txt size={18} weight={700}>
          Yeni duyuru
        </Txt>
        <Field label="Başlık" value={title} onChangeText={setTitle} placeholder="Başlık" style={{ borderRadius: 12 }} />
        <Field label="Duyuru metni" value={body} onChangeText={setBody} placeholder="Ekibe ne söylemek istiyorsun?" multiline minHeight={100} style={{ borderRadius: 12 }} />
        <Press onPress={() => setPin((v) => !v)} role="checkbox" accessibilityState={{ checked: pin }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
          <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.a2, backgroundColor: pin ? colors.a2 : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {pin && <Icon name="check" size={14} color={colors['a2-ink']} strokeWidth={3} />}
          </View>
          <Txt size={14.5} weight={600} style={{ flex: 1 }}>
            Akışın en üstüne sabitle (herkese bildirim gider)
          </Txt>
        </Press>
        <Button label={busy ? 'Yayınlanıyor…' : 'Yayınla'} size="lg" onPress={publish} disabled={busy} />
      </Card>

      <View style={{ flexGrow: 999, flexShrink: 1, flexBasis: 420, minWidth: 0, gap: 12 }}>
        {anns.loading && <SkeletonCards count={2} lines={1} />}
        {(anns.data ?? []).length === 0 && !anns.loading && (
          <EmptyState title="Henüz duyuru yok" description="Yazdığın duyurular burada listelenir." />
        )}
        {(anns.data ?? []).map((a) => {
          const confirming = confirm === a.id;
          return (
            <Card key={a.id} radius={20} padding={16} gap={8} style={{ paddingHorizontal: 18, boxShadow: `0 0 0 2px ${a.pinned ? colors.bar : 'transparent'}` }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {a.pinned && (
                  <Box bg="a1" style={{ borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
                    <Txt size={11.5} weight={700} color="a1-ink" leading={1.2}>
                      Sabit
                    </Txt>
                  </Box>
                )}
                <Txt size={16} weight={700} style={{ flex: 1 }}>
                  {a.title}
                </Txt>
                <Txt size={12.5} color="muted">
                  {timeAgo(a.created_at)}
                </Txt>
              </View>
              {!!a.body && (
                <Txt size={14.5} color="text-3" style={{ maxWidth: 620 }}>
                  {a.body}
                </Txt>
              )}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button
                  label={a.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                  size="sm"
                  kind="soft"
                  onPress={async () => report(await setAnnouncementPinned(a.id, !a.pinned), a.pinned ? 'Sabitleme kaldırıldı' : 'Akışın üstüne sabitlendi')}
                />
                <Button
                  label={confirming ? 'Emin misin? Sil' : 'Sil'}
                  size="sm"
                  kind="soft"
                  style={confirming ? { backgroundColor: '#E06C6C' } : undefined}
                  onPress={async () => {
                    if (!confirming) {
                      setConfirm(a.id);
                      return;
                    }
                    setConfirm(null);
                    report(await deleteAnnouncement(a.id), 'Duyuru silindi');
                  }}
                />
              </View>
            </Card>
          );
        })}
      </View>
    </View>
  );
}
