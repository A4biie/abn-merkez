import { router } from 'expo-router';
import { openProfile } from '@/lib/profileModal';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';

import { ProgressBar, nextStep } from '@/components/projects/ProjectParts';
import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Button, Card, Chip, Pill } from '@/components/ui/Controls';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { friendlyError } from '@/lib/errors';
import { AVAILABILITY, PROJECT_STATUS, REQUEST_STATUS } from '@/lib/labels';
import { askStillYours, decideRequest, setNeedsHelp, useTasks } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import { daysSince, formatDate, thisWeek } from '@/lib/time';
import type { Availability, Task, TeamRequest } from '@/lib/types';
import type { Token } from '@/theme/themes';
import { AdminAnnouncements, AdminLocks, AdminMembers, AdminProjects } from './AdminManage';
import { TableRow } from './TableRow';

export type AdminTab = 'genel' | 'istek' | 'uye' | 'proje' | 'kilit' | 'duyuru';

const TABS: [AdminTab, string][] = [
  ['genel', 'Genel bakış'],
  ['istek', 'İstekler'],
  ['uye', 'Üyeler'],
  ['proje', 'Projeler'],
  ['kilit', 'Görev kilitleri'],
  ['duyuru', 'Duyurular'],
];

/** Hareketsiz sayılan görev: bu kadar gündür durumu değişmemiş (Akış'taki hatırlatmayla aynı). */
const STALE_DAYS = 14;

/** Desktop.dc.html "Yönetim paneli". Kişiler arası karşılaştırma ya da sıralama yok. */
export type AnnouncementDraft = { title: string; body: string };

export function AdminPanel({
  initialTab = 'genel',
  announcementDraft,
}: {
  initialTab?: AdminTab;
  /** Oylama sonucundan gelen duyuru taslağı. */
  announcementDraft?: AnnouncementDraft;
}) {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const team = useTeam();
  const pending = team.requests.filter((r) => r.status === 'bekliyor').length;

  return (
    <View style={{ gap: 20 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 0 }}>
        <Box bg="surface" shadow style={{ flexDirection: 'row', gap: 4, borderRadius: 999, padding: 4 }}>
          {TABS.map(([key, label]) => (
            <Pill
              key={key}
              onSheet
              label={label}
              suffix={key === 'istek' && pending ? String(pending) : undefined}
              active={tab === key}
              onPress={() => setTab(key)}
              style={tab === key ? undefined : { backgroundColor: 'transparent' }}
            />
          ))}
        </Box>
      </ScrollView>

      {team.loading ? (
        <SkeletonCards count={2} />
      ) : team.error ? (
        <ErrorState message={team.error} onRetry={team.refetch} />
      ) : tab === 'genel' ? (
        <Overview goTab={setTab} />
      ) : tab === 'istek' ? (
        <Requests />
      ) : tab === 'uye' ? (
        <AdminMembers />
      ) : tab === 'proje' ? (
        <AdminProjects />
      ) : tab === 'kilit' ? (
        <AdminLocks />
      ) : (
        <AdminAnnouncements draft={announcementDraft} />
      )}
    </View>
  );
}

// ───────────────────────── Genel bakış ─────────────────────────

function Overview({ goTab }: { goTab: (t: AdminTab) => void }) {
  const say = useToast();
  const team = useTeam();
  const tasks = useTasks();
  const [asked, setAsked] = useState<Record<string, boolean>>({});

  const all = tasks.data ?? [];
  const open = all.filter((t) => t.status !== 'bitti');
  const pool = all.filter((t) => t.status === 'havuz');
  const blocked = open.filter((t) => t.needs_help);
  const stale = open.filter((t) => t.assignee_id && t.status !== 'havuz' && daysSince(t.status_changed_at) >= STALE_DAYS);
  const pendingReqs = team.requests.filter((r) => r.status === 'bekliyor');
  const people = [...team.people.values()];
  const resting = people.filter((p) => p.availability === 'ara');
  const doneWeek = all.filter((t) => t.status === 'bitti' && new Date(t.status_changed_at) >= thisWeek().start).length;
  const active = team.projects.filter((p) => p.status === 'gelistirmede' || p.status === 'test').length;

  const kpis: { value: number; label: string; sub: string; bg: Token; fg: Token; go: () => void }[] = [
    { value: active, label: 'Aktif proje', sub: `${team.projects.length} projeden`, bg: 'a2', fg: 'a2-ink', go: () => router.navigate('/projeler') },
    {
      value: open.length,
      label: 'Açık görev',
      sub: `${open.filter((t) => t.assignee_id).length} tanesi birinde`,
      bg: 'surface',
      fg: 'text',
      go: () => router.navigate({ pathname: '/gorevler', params: { sekme: 'tumu' } }),
    },
    { value: pool.length, label: 'Havuzda', sub: 'Sahibini bekliyor', bg: 'a3', fg: 'a3-ink', go: () => router.navigate({ pathname: '/gorevler', params: { sekme: 'havuz' } }) },
    { value: blocked.length, label: 'Yardım bekleyen', sub: blocked.length ? 'Bir göz at' : 'Kimse takılmadı', bg: 'surface', fg: 'text', go: () => {} },
    { value: doneWeek, label: 'Bu hafta biten', sub: 'Emeğinize sağlık', bg: 'a1', fg: 'a1-ink', go: () => router.navigate('/ozet') },
  ];

  type Row = { key: string; icon: IconName; dot: string; text: string; sub: string; btn: string; muted?: boolean; act: () => void };
  const attention: Row[] = [
    ...blocked.map((t) => ({
      key: `b${t.id}`,
      icon: 'alert' as IconName,
      dot: '#F5C77E',
      text: `${team.nameOf(t.assignee_id)} · ${t.title}`,
      sub: 'Yardım istiyor',
      btn: 'Çözüldü',
      act: async () => {
        const e = await setNeedsHelp(t.id, false);
        say(e ? friendlyError(e) : 'Çözüldü olarak işaretlendi');
      },
    })),
    ...stale.map((t) => ({
      key: `s${t.id}`,
      icon: 'clock' as IconName,
      dot: '#8EE8F5',
      text: `${team.nameOf(t.assignee_id)} · ${t.title}`,
      sub: asked[t.id] ? '“Hâlâ sende mi?” sorusu gönderildi' : 'Bir süredir hareketsiz',
      btn: asked[t.id] ? 'Soruldu' : 'Nazikçe sor',
      muted: asked[t.id],
      act: async () => {
        if (asked[t.id]) return;
        const e = await askStillYours(t.id);
        if (e) {
          say(friendlyError(e));
          return;
        }
        setAsked((a) => ({ ...a, [t.id]: true }));
        say(`${team.nameOf(t.assignee_id)} kişisine sadece kendisinin göreceği bir soru gitti`);
      },
    })),
    ...(pendingReqs.length
      ? [{ key: 'req', icon: 'inbox' as IconName, dot: '#C5B5FA', text: `${pendingReqs.length} bekleyen istek`, sub: 'Proje katılımı ve görev talepleri', btn: 'İncele', act: () => goTab('istek') }]
      : []),
    ...(pool.length
      ? [{ key: 'pool', icon: 'pool' as IconName, dot: '#E4F68F', text: `${pool.length} görev havuzda sahibini bekliyor`, sub: 'Kilitlerini kontrol etmek isteyebilirsin', btn: 'Kilitler', act: () => goTab('kilit') }]
      : []),
    ...resting.map((p) => {
      const oc = open.filter((t) => t.assignee_id === p.id).length;
      return {
        key: `r${p.id}`,
        icon: 'moon' as IconName,
        dot: '#F2A7C3',
        text: `${p.full_name} molada${p.availability_until ? ` · ${formatDate(p.availability_until)}’a kadar` : ''}`,
        sub: oc ? `${oc} açık görevi var, istersen havuza alabilirsin` : 'Üzerinde açık görev yok',
        btn: 'Profil',
        act: () => openProfile(p.id),
      };
    }),
  ];

  const dist = (Object.keys(AVAILABILITY) as Availability[])
    .map((k) => {
      const count = people.filter((p) => p.availability === k).length;
      return { key: k, ...AVAILABILITY[k], count, pct: people.length ? (count / people.length) * 100 : 0 };
    })
    .filter((d) => d.count > 0);

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {kpis.map((k) => (
          <Press
            key={k.label}
            onPress={k.go}
            bg={k.bg}
            shadow
            pressScale={0.97}
            style={{ flexGrow: 1, flexBasis: 170, borderRadius: 22, padding: 18, gap: 4 }}
          >
            <Txt size={34} weight={700} leading={1} color={k.fg} style={{ fontVariant: ['tabular-nums'] }}>
              {k.value}
            </Txt>
            <Txt size={14} weight={600} color={k.fg}>
              {k.label}
            </Txt>
            <Txt size={12.5} color={k.fg} style={{ opacity: 0.75 }}>
              {k.sub}
            </Txt>
          </Press>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Card radius={24} padding={20} gap={4} style={{ flexGrow: 999, flexShrink: 1, flexBasis: 440, minWidth: 0 }}>
          <Txt size={18} weight={700} style={{ marginBottom: 8 }}>
            Dikkat isteyenler
          </Txt>
          {tasks.loading && <SkeletonCards count={1} lines={1} />}
          {!tasks.loading && attention.length === 0 && (
            <Txt size={14} color="muted" style={{ paddingVertical: 8 }}>
              Her şey yolunda görünüyor.
            </Txt>
          )}
          {attention.map((a) => (
            <Box key={a.key} border="line" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderWidth: 0, borderTopWidth: 1 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: a.dot, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={a.icon} size={18} color="#0E0E10" strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight={600}>{a.text}</Txt>
                <Txt size={13} color="muted">
                  {a.sub}
                </Txt>
              </View>
              <Button
                label={a.btn}
                size="sm"
                kind={a.key === 'req' ? 'accent' : a.muted ? 'muted' : 'soft'}
                bold={a.key === 'req' || !a.muted}
                onPress={a.act}
              />
            </Box>
          ))}
        </Card>

        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0, gap: 20 }}>
          <Card radius={24} padding={20} gap={14}>
            <Txt size={18} weight={700}>
              Proje ilerlemesi
            </Txt>
            {team.projects.length === 0 && <Txt color="muted">Henüz proje yok. Projeler sekmesinden açabilirsin.</Txt>}
            {team.projects.map((p) => {
              const st = PROJECT_STATUS[p.status];
              const oc = open.filter((t) => t.project_id === p.id).length;
              return (
                <View key={p.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Txt weight={600} style={{ flex: 1 }}>
                      {p.name}
                    </Txt>
                    <Chip label={st.label} bg={st.bg} fg={st.fg} />
                  </View>
                  <ProgressBar pct={p.progress} />
                  <Txt size={12.5} color="muted">
                    Sıradaki: {nextStep(p)} · {oc} açık görev
                  </Txt>
                </View>
              );
            })}
          </Card>
          <Card radius={24} padding={20} gap={12}>
            <Txt size={18} weight={700}>
              Ekip durumu
            </Txt>
            <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 3 }}>
              {dist.map((d) => (
                <View key={d.key} style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
              {dist.map((d) => (
                <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: d.color }} />
                  <Txt size={13.5}>
                    {d.label}{' '}
                    <Txt size={13.5} weight={700}>
                      {d.count}
                    </Txt>
                  </Txt>
                </View>
              ))}
            </View>
          </Card>
        </View>
      </View>
    </View>
  );
}

// ───────────────────────── İstekler ─────────────────────────

function Requests() {
  const say = useToast();
  const team = useTeam();
  const tasks = useTasks();
  const rows = [...team.requests.filter((r) => r.status === 'bekliyor'), ...team.requests.filter((r) => r.status !== 'bekliyor')];
  const taskTitle = (id: string | null) => (tasks.data ?? []).find((t: Task) => t.id === id)?.title ?? '';

  async function decide(r: TeamRequest, ok: boolean) {
    const e = await decideRequest(r.id, ok);
    say(e ? friendlyError(e) : ok ? `${team.nameOf(r.requester_id)} için kabul edildi` : 'Şimdilik olmadı dedin, nazikçe haber verildi');
  }

  const W = [200, 300, 220, 140, 230];
  return (
    <Card radius={24} padding={0} gap={0} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <TableRow
            header
            first
            cells={[
              { w: W[0], node: 'Kim' },
              { w: W[1], node: 'İstek' },
              { w: W[2], node: 'Kime gider' },
              { w: W[3], node: 'Durum' },
              { w: W[4], node: 'İşlem', right: true },
            ]}
          />
          {rows.map((r) => {
            const who = team.person(r.requester_id);
            const st = REQUEST_STATUS[r.status];
            return (
              <TableRow
                key={r.id}
                cells={[
                  {
                    w: W[0],
                    node: (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {who && <Avatar person={who} size={32} />}
                        <Txt weight={700}>{who?.full_name ?? 'Biri'}</Txt>
                      </View>
                    ),
                  },
                  {
                    w: W[1],
                    node: (
                      <Txt size={14.5}>
                        {r.kind === 'proje'
                          ? `${team.projectMap.get(r.project_id ?? '')?.name ?? 'Bir'} projesine katılmak istiyor`
                          : `“${taskTitle(r.task_id)}” görevini almak istiyor`}
                      </Txt>
                    ),
                  },
                  {
                    w: W[2],
                    node: (
                      <Txt size={14.5} color="muted">
                        {r.kind === 'proje' ? `Proje yöneticisi · ${team.leadName(r.project_id ?? '')}` : 'Yöneticiler'}
                      </Txt>
                    ),
                  },
                  { w: W[3], node: <Chip label={st.label} bg={st.bg} fg={st.fg} /> },
                  {
                    w: W[4],
                    right: true,
                    node:
                      r.status === 'bekliyor' ? (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <Button label="Kabul et" size="sm" onPress={() => decide(r, true)} />
                          <Button label="Şimdilik değil" size="sm" kind="soft" onPress={() => decide(r, false)} />
                        </View>
                      ) : null,
                  },
                ]}
              />
            );
          })}
          {rows.length === 0 && (
            <EmptyState title="Bekleyen istek yok" description="Biri göreve ya da projeye katılmak isteyince burada görünür." />
          )}
        </View>
      </ScrollView>
    </Card>
  );
}
