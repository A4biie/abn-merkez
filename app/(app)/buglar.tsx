// Buglar (0.11 bölüm 6, design/abn-09.html: .bstats / .bcols / .bug / .drawer). Üstte "Çıkışa hazır mı?" ve sayılar,
// altında 5 sütun. Karta tıklayınca sağdan detay paneli kayar; durum düğmeleri bug_action() ile ilerletir.

import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Choice, Lab } from '@/components/chat/ConvertTaskModal';
import { Screen } from '@/components/layout/Screen';
import { useIsWide } from '@/components/layout/useIsWide';
import { PresenceAvatar } from '@/components/profile/ProfileCard';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import {
  BUG_STATUS,
  bugAction,
  code,
  createBuild,
  deleteBug,
  OK,
  openBugForm,
  SEV,
  useBugEvents,
  useBugs,
  useBuilds,
  type Bug,
  type BugAction,
} from '@/lib/bugs';
import { fileUrl } from '@/lib/files';
import { useTeam } from '@/lib/team';
import { timeAgo } from '@/lib/time';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

const SPRING = 'cubic-bezier(0.2, 1.25, 0.35, 1)';
const drIn = css.keyframes({ from: { opacity: 0, transform: [{ translateX: 40 }] }, to: { opacity: 1, transform: [{ translateX: 0 }] } });
const drOut = css.keyframes({ from: { opacity: 1, transform: [{ translateX: 0 }] }, to: { opacity: 0, transform: [{ translateX: 40 }] } });
const mIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.97 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const fadeOut = css.keyframes({ from: { opacity: 1 }, to: { opacity: 0 } });

export default function Buglar() {
  const { colors } = useTheme();
  const wide = useIsWide();
  const bugs = useBugs();
  const builds = useBuilds();
  const params = useLocalSearchParams<{ bug?: string }>();
  const [sel, setSel] = useState<string | null>(params.bug ?? null);
  const [seen, setSeen] = useState(params.bug);
  if (params.bug !== seen) {
    setSeen(params.bug);
    if (params.bug) setSel(params.bug);
  }
  const [closing, setClosing] = useState(false);
  const [newBuild, setNewBuild] = useState(false);

  const all = bugs.data ?? [];
  const crit = all.filter((b) => b.severity === 'kritik' && b.status !== 'kapandi').length;
  const open = all.filter((b) => b.status !== 'kapandi').length;
  const testing = all.filter((b) => b.status === 'test').length;
  const [now] = useState(() => Date.now());
  const weekAgo = now - 7 * 86400_000;
  const closedWeek = all.filter((b) => b.status === 'kapandi' && b.closed_at && new Date(b.closed_at).getTime() > weekAgo).length;
  const latest = builds.data?.[0];
  const selected = all.find((b) => b.id === sel) ?? null;

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setSel(null);
      setClosing(false);
      router.setParams({ bug: undefined });
    }, 170);
  };

  const pill = (label: string, onPress: () => void, primary = false) => (
    <Press
      onPress={onPress}
      bg={primary ? 'a2' : undefined}
      gradient={primary ? 'btn' : undefined}
      style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: primary ? undefined : colors.chip }}
    >
      <Txt size={13} weight={800} color={primary ? 'a2-ink' : undefined}>
        {label}
      </Txt>
    </Press>
  );

  return (
    <Screen
      title="Buglar"
      crumb={latest ? 'Son build ' + latest.version : 'Henüz build yok'}
      onRefresh={bugs.refetch}
      action={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {pill('⬆ Yeni build', () => setNewBuild(true))}
          {pill('🐞 Bug bildir', () => openBugForm(), true)}
        </View>
      }
    >
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 2, flexBasis: 260, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 14 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `color-mix(in srgb, ${crit ? SEV.kritik.color : OK} 20%, transparent)`,
            }}
          >
            <Txt size={16} weight={800} style={{ color: crit ? SEV.kritik.color : OK }}>
              {crit ? '✕' : '✓'}
            </Txt>
          </View>
          <View>
            <Txt size={16} weight={800}>
              {crit ? 'Çıkışa hazır değil' : 'Çıkışa hazır'}
            </Txt>
            <Txt size={13} color="muted">
              {crit ? `${crit} tane oyunu bozan bug açık` : 'Oyunu bozan açık bug yok'}
            </Txt>
          </View>
        </View>
        <Stat label="Açık" value={open} />
        <Stat label="Test bekliyor" value={testing} />
        <Stat label="Bu hafta kapanan" value={closedWeek} />
      </View>

      <ScrollView horizontal={!wide} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', gap: 10, flex: 1, minWidth: wide ? undefined : 5 * 230 }}>
          {BUG_STATUS.map(([st, label]) => {
            const list = all.filter((b) => b.status === st);
            return (
              <View key={st} style={{ flex: 1, minWidth: 200, gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 4 }}>
                  <Txt size={12.5} weight={800}>
                    {label}
                  </Txt>
                  <Txt size={12.5} weight={800} color="muted">
                    {list.length}
                  </Txt>
                </View>
                {list.map((b) => (
                  <BugCard key={b.id} b={b} sel={b.id === sel} build={builds.data?.find((x) => x.id === b.build_id)?.version} onPress={() => setSel(b.id)} />
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {selected && <Drawer bug={selected} closing={closing} onClose={close} full={!wide} />}
      {newBuild && <BuildModal onClose={() => setNewBuild(false)} />}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 150, borderRadius: 14, backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 14, gap: 2 }}>
      <Lab>{label}</Lab>
      <Txt size={24} weight={800} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Txt>
    </View>
  );
}

function SevPill({ s }: { s: Bug['severity'] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: `color-mix(in srgb, ${SEV[s].color} 18%, transparent)` }}>
      <Txt size={11} weight={800} style={{ color: SEV[s].color }}>
        {SEV[s].label}
      </Txt>
    </View>
  );
}

function BugCard({ b, sel, build, onPress }: { b: Bug; sel: boolean; build?: string; onPress: () => void }) {
  const { colors } = useTheme();
  const team = useTeam();
  const [hover, setHover] = useState(false);
  const who = team.person(b.assignee_id);
  return (
    <Press
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      pressScale={0.98}
      style={{
        borderRadius: 12,
        backgroundColor: colors.surface,
        paddingVertical: 10,
        paddingRight: 12,
        paddingLeft: 15,
        gap: 7,
        overflow: 'hidden',
        boxShadow: sel
          ? `0 0 0 2px ${colors.a1}`
          : `0 0 0 1px ${hover ? `color-mix(in srgb, ${colors.a1} 40%, transparent)` : colors.line}`,
      }}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: SEV[b.severity].color }} />
      <Txt size={11} color="muted" style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
        {code(b)}
        {build ? ' · ' + build : ''}
      </Txt>
      <Txt size={13} weight={700} leading={1.3}>
        {b.title}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <SevPill s={b.severity} />
        <View style={{ marginLeft: 'auto' }}>
          {who ? (
            <PresenceAvatar person={who} size={20} isMe={who.id === team.meId} ring={colors.surface} dot={false} />
          ) : (
            <Txt size={11.5} color="muted">
              atanmadı
            </Txt>
          )}
        </View>
      </View>
    </Press>
  );
}

function Drawer({ bug, closing, onClose, full }: { bug: Bug; closing: boolean; onClose: () => void; full: boolean }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const team = useTeam();
  const say = useToast();
  const builds = useBuilds();
  const events = useBugEvents(bug.id);
  const [shot, setShot] = useState('');
  const [busy, setBusy] = useState(false);
  const idx = BUG_STATUS.findIndex(([s]) => s === bug.status);
  const build = builds.data?.find((b) => b.id === bug.build_id)?.version;
  const fixed = builds.data?.find((b) => b.id === bug.fixed_build_id)?.version;
  const me = team.meId;
  const canClose = me === bug.reporter_id || me === bug.assignee_id || team.isAdmin;
  const canWork = me === bug.assignee_id || team.isAdmin;

  useEffect(() => {
    if (bug.attachment_path) fileUrl({ bucket: 'bug-files', path: bug.attachment_path }).then(setShot);
  }, [bug.attachment_path]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const act = async (a: BugAction, msg: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await bugAction(bug, a);
      say(msg);
    } catch (e) {
      say((e as { message?: string }).message ?? 'Yapılamadı');
    } finally {
      setBusy(false);
    }
  };
  const reporter = team.nameOf(bug.reporter_id);
  const assignee = team.nameOf(bug.assignee_id);

  const btn = (label: string, a: BugAction, msg: string, primary = false, show = true) =>
    show ? (
      <Press
        key={a}
        onPress={() => act(a, msg)}
        bg={primary ? 'a2' : undefined}
        gradient={primary ? 'btn' : undefined}
        style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: primary ? undefined : colors.chip, opacity: busy ? 0.6 : 1 }}
      >
        <Txt size={13} weight={800} color={primary ? 'a2-ink' : undefined}>
          {label}
        </Txt>
      </Press>
    ) : null;

  const actions =
    bug.status === 'yeni'
      ? [btn('Bende', 'take', 'Sana atandı', true), btn('Bug değil, kapat', 'notbug', 'Kapatıldı', false, canClose)]
      : bug.status === 'atandi'
        ? [
            btn('Düzeltildi · sonraki build\'e girecek', 'fix', 'Düzeltildi olarak işaretlendi', true, canWork),
            btn('Bende', 'take', 'Sana atandı', false, bug.assignee_id !== me),
          ]
        : bug.status === 'duzeltildi'
          ? [btn(fixed ? `Build çıktı (${fixed}), teste gönder` : 'Build çıktı, teste gönder', 'totest', `${reporter}'a "test et" bildirimi gitti`, true, canWork)]
          : bug.status === 'test'
            ? [btn('✓ Çalışıyor, kapat', 'ok', code(bug) + ' kapandı 🎉', true, canClose), btn('Hâlâ bozuk', 'broken', `Yeniden açıldı, ${assignee}'a haber verildi`)]
            : [btn('Yeniden aç', 'reopen', 'Yeniden açıldı')];

  return (
    <Animated.View
      role="dialog"
      aria-label={code(bug)}
      style={{
        position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: full ? '100%' : 420,
        zIndex: 900,
        backgroundColor: colors.surface,
        boxShadow: `-1px 0 0 ${colors.line}, -20px 0 50px rgba(0,0,0,.35)`,
        animationName: motion.reduced ? (closing ? fadeOut : fadeIn) : closing ? drOut : drIn,
        animationDuration: closing ? 180 : 280,
        animationTimingFunction: closing ? 'ease' : SPRING,
        animationFillMode: 'both',
      }}
    >
      <View style={{ paddingTop: 16, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.line, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt size={11} color="muted" style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
            {code(bug)}
          </Txt>
          <SevPill s={bug.severity} />
          <Press
            onPress={onClose}
            accessibilityLabel="Kapat"
            style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chip }}
          >
            <Txt size={14} weight={800}>
              ✕
            </Txt>
          </Press>
        </View>
        <Txt size={18} weight={800} leading={1.25}>
          {bug.title}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {BUG_STATUS.map(([s, label], k) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {k > 0 && (
                <Txt size={11} color="muted">
                  ›
                </Txt>
              )}
              <View style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: k === idx ? colors.a1 : colors.chip }}>
                <Txt size={11} weight={800} color={k === idx ? 'a1-ink' : k < idx ? 'text-2' : 'muted'}>
                  {label}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 18, gap: 14 }}>
        {bug.attachment_path && shot ? (
          bug.attachment_kind === 'video' && Platform.OS === 'web' ? (
            <video src={shot} controls style={{ width: '100%', borderRadius: 12 }} />
          ) : (
            <Image source={{ uri: shot }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: '#000' }} resizeMode="contain" />
          )
        ) : null}
        <View style={{ gap: 6 }}>
          <Lab>Nasıl tekrar edilir</Lab>
          {bug.steps.length ? (
            bug.steps.map((s, i) => (
              <Txt key={i} size={13.5} color="text-2">
                {i + 1}. {s}
              </Txt>
            ))
          ) : (
            <Txt size={13} color="muted">
              Adım yazılmadı
            </Txt>
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Kv k="Bildiren" v={reporter} />
          <Kv k="Atanan" v={bug.assignee_id ? assignee : 'Kimse'} />
          <Kv k="Build" v={(build ?? 'Bilinmiyor') + (fixed ? ' → ' + fixed : '')} mono />
          <Kv k="Bilgisayar" v={bug.device || 'Bilinmiyor'} />
        </View>
        <View style={{ gap: 8 }}>
          <Lab>Geçmiş</Lab>
          {(events.data ?? []).map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', gap: 10 }}>
              <Txt size={11.5} color="muted" style={{ minWidth: 64 }}>
                {timeAgo(e.created_at)}
              </Txt>
              <Txt size={13} color="text-2" style={{ flex: 1 }}>
                {e.text}
              </Txt>
            </View>
          ))}
        </View>
        {team.isAdmin && (
          <Press
            onPress={async () => {
              if (Platform.OS === 'web' && !window.confirm(`${code(bug)} silinsin mi? Geri alınamaz.`)) return;
              try {
                await deleteBug(bug);
                onClose();
                say('Bug silindi');
              } catch {
                say('Silinemedi');
              }
            }}
            style={{ alignSelf: 'flex-start' }}
          >
            <Txt size={12} weight={700} color="muted">
              Bug&apos;ı sil (yönetici)
            </Txt>
          </Press>
        )}
      </ScrollView>
      <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderTopWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {actions}
      </View>
    </Animated.View>
  );
}

function Kv({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', borderRadius: 10, backgroundColor: colors.surface2, paddingVertical: 8, paddingHorizontal: 10, minWidth: 0 }}>
      <Lab>{k}</Lab>
      <Txt size={13} weight={800} style={mono ? { fontFamily: 'JetBrains Mono, ui-monospace, monospace' } : undefined}>
        {v}
      </Txt>
    </View>
  );
}

function BuildModal({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const team = useTeam();
  const say = useToast();
  const [project, setProject] = useState('');
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const field = {
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: 14,
    fontFamily: 'Urbanist',
    outlineStyle: 'none',
  } as object;
  const save = async () => {
    if (!version.trim()) return;
    try {
      await createBuild(project || null, version.trim(), notes.trim());
      onClose();
      say(`Build ${version.trim()} kaydedildi`);
    } catch (e) {
      const m = (e as { message?: string }).message ?? '';
      say(m.includes('duplicate') ? 'Bu build numarası zaten var' : 'Build kaydedilemedi');
    }
  };
  return (
    <View style={{ position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute', inset: 0, zIndex: 1050, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.55)' } as object}>
      <Press onPress={onClose} accessibilityLabel="Kapat" pressScale={1} style={{ position: 'absolute', inset: 0 } as object} />
      <Animated.View
        role="dialog"
        aria-label="Yeni build"
        style={{
          width: '100%',
          maxWidth: 480,
          borderRadius: 18,
          padding: 18,
          gap: 12,
          backgroundColor: colors.surface,
          boxShadow: `0 0 0 1px ${colors.line}, 0 24px 60px rgba(0,0,0,.45)`,
          animationName: motion.reduced ? fadeIn : mIn,
          animationDuration: 260,
          animationTimingFunction: SPRING,
          animationFillMode: 'both',
        }}
      >
        <Txt size={18} weight={800}>
          ⬆ Yeni build
        </Txt>
        <View style={{ gap: 6 }}>
          <Lab>Proje</Lab>
          <Choice label="Proje" value={project} options={[{ value: '', label: 'Projesiz' }, ...team.projects.map((p) => ({ value: p.id, label: p.name }))]} onChange={setProject} />
        </View>
        <View style={{ gap: 6 }}>
          <Lab>Build numarası</Lab>
          <TextInput autoFocus value={version} onChangeText={setVersion} placeholder="ör. 0.3.3" placeholderTextColor={colors.muted} maxLength={32} style={field} />
        </View>
        <View style={{ gap: 6 }}>
          <Lab>Notlar</Lab>
          <TextInput value={notes} onChangeText={setNotes} multiline numberOfLines={3} placeholder="Neler değişti?" placeholderTextColor={colors.muted} style={[field, { minHeight: 70, textAlignVertical: 'top' }]} />
        </View>
        <Txt size={12} color="muted">
          &quot;Düzeltildi&quot; sütunundaki buglar bu build&apos;e bağlanır.
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Press onPress={onClose} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.chip }}>
            <Txt size={13} weight={800}>
              Vazgeç
            </Txt>
          </Press>
          <Press onPress={save} bg="a2" gradient="btn" style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 }}>
            <Txt size={13} weight={800} color="a2-ink">
              Build&apos;i kaydet
            </Txt>
          </Press>
        </View>
      </Animated.View>
    </View>
  );
}
