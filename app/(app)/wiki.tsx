// Wiki (0.11 bölüm 4, design/abn-09.html: .wiki / .tree / .doc). Solda sayfa ağacı, sağda sayfa.
// "✏️ Düzenle" sayfayı yerinde düzenlenebilir yapar (a1 çerçeve), "✓ Bitti" kaydeder. Aynı anda başkası düzenliyorsa
// uyarı çıkar; arada başkası kaydettiyse üzerine yazılmaz (sürüm kontrolü), eski sürümler geçmişte durur.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, TextInput, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { useIsWide } from '@/components/layout/useIsWide';
import { PresenceAvatar } from '@/components/profile/ProfileCard';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { WikiEditor, type WikiEditorHandle } from '@/components/wiki/WikiEditor';
import { WikiTree } from '@/components/wiki/WikiTree';
import { useTeam } from '@/lib/team';
import { timeAgo } from '@/lib/time';
import {
  ancestry,
  createPage,
  deletePage,
  editingOther,
  markEditing,
  restoreRevision,
  savePage,
  useRevisions,
  useWiki,
  WikiConflict,
  type WikiPage,
} from '@/lib/wiki';
import { useTheme } from '@/theme/ThemeProvider';

export default function Wiki() {
  const { colors } = useTheme();
  const wide = useIsWide();
  const team = useTeam();
  const say = useToast();
  const wiki = useWiki();
  const pages = wiki.data ?? [];
  const params = useLocalSearchParams<{ sayfa?: string }>();
  const [sel, setSel] = useState<string | null>(params.sayfa ?? null);
  const [seenParam, setSeenParam] = useState(params.sayfa);
  if (params.sayfa !== seenParam) {
    setSeenParam(params.sayfa);
    if (params.sayfa) setSel(params.sayfa);
  }
  const roots = pages.filter((p) => !p.parent_id).sort((a, b) => a.position - b.position);
  const page = pages.find((p) => p.id === sel) ?? roots[0] ?? null;
  const [editing, setEditing] = useState<{ id: string; base: number; title: string } | null>(null);
  const [conflict, setConflict] = useState<string | null | false>(false);
  const [history, setHistory] = useState(false);
  const editor = useRef<WikiEditorHandle>(null);
  const isEditing = !!page && editing?.id === page.id;

  // Düzenlerken "düzenliyor" işaretini 30 sn'de bir tazele; çıkınca temizle.
  useEffect(() => {
    if (!isEditing || !page) return;
    const id = page.id;
    markEditing(id, true, team.meId);
    const t = setInterval(() => markEditing(id, true, team.meId), 30_000);
    return () => {
      clearInterval(t);
      markEditing(id, false, team.meId);
    };
  }, [isEditing, page?.id, team.meId]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (id: string) => {
    if (isEditing) return say('Önce "✓ Bitti" ile kaydet');
    setHistory(false);
    setSel(id);
    router.setParams({ sayfa: id });
  };

  const startEdit = () => page && setEditing({ id: page.id, base: page.version, title: page.title });

  const finish = async (force = false) => {
    if (!page || !editing) return;
    const html = editor.current?.html() ?? page.content;
    try {
      await savePage(page, editing.title, html, force ? page.version : editing.base);
      setEditing(null);
      setConflict(false);
      say('Sayfa kaydedildi');
    } catch (e) {
      if (e instanceof WikiConflict) setConflict(e.by);
      else say('Kaydedilemedi, tekrar dene');
    }
  };

  const newPage = async () => {
    if (isEditing) return say('Önce "✓ Bitti" ile kaydet');
    // Bulunduğun bölümün (en üstteki sayfa) altına; hiç sayfa yoksa yeni bölüm.
    const section = page ? ancestry(pages, page.id)[0] : null;
    try {
      const p = await createPage(section?.id ?? null, 'Yeni sayfa', section ? '' : '📁');
      setSel(p.id);
      setEditing({ id: p.id, base: p.version, title: p.title });
    } catch {
      say('Sayfa oluşturulamadı');
    }
  };
  const newSection = async () => {
    try {
      const p = await createPage(null, 'Yeni bölüm', '📁');
      setSel(p.id);
      setEditing({ id: p.id, base: p.version, title: p.title });
    } catch {
      say('Bölüm oluşturulamadı');
    }
  };

  const remove = async () => {
    if (!page) return;
    const kids = pages.filter((p) => p.parent_id === page.id).length;
    const ok =
      Platform.OS !== 'web' ||
      window.confirm(`"${page.title}" silinsin mi?${kids ? ` Alt sayfaları (${kids}) da silinir.` : ''} Geri alınamaz.`);
    if (!ok) return;
    try {
      await deletePage(page.id);
      setSel(page.parent_id);
      say('Sayfa silindi');
    } catch {
      say('Silinemedi');
    }
  };

  const other = page ? editingOther(page, team.meId) : null;
  const canDelete = !!page && (page.created_by === team.meId || team.isAdmin);
  const actions = (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {page && Platform.OS === 'web' && <Btn label={isEditing ? '✓ Bitti' : '✏️ Düzenle'} onPress={isEditing ? () => finish() : startEdit} />}
      {page && !isEditing && <Btn label="🕘 Geçmiş" onPress={() => setHistory((h) => !h)} />}
      <Btn label="+ Yeni sayfa" onPress={newPage} primary />
    </View>
  );

  const crumb = page ? ancestry(pages, page.id) : [];
  const editor_ = page ? team.person(page.updated_by) : undefined;

  const tree = (
    <View style={{ width: wide ? 220 : undefined, gap: 6 }}>
      <WikiTree pages={pages} current={page?.id ?? null} onOpen={open} />
      <Press onPress={newSection} style={{ paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9 }}>
        <Txt size={13} weight={700} color="muted">
          + Yeni bölüm
        </Txt>
      </Press>
    </View>
  );

  return (
    <Screen title="Wiki" crumb="Ekip bilgisi" action={actions}>
      {wiki.loading && !pages.length ? (
        <Txt color="muted">Yükleniyor…</Txt>
      ) : !pages.length ? (
        <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
          <Txt color="muted">Wiki henüz boş.</Txt>
          <Btn label="+ İlk sayfayı oluştur" onPress={newSection} primary />
        </View>
      ) : (
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 18, alignItems: 'flex-start' }}>
          {tree}
          {page && (
            <View style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', borderRadius: 16, backgroundColor: colors.surface, paddingVertical: 24, paddingHorizontal: wide ? 28 : 18, gap: 6 }}>
              <Txt size={12} weight={700} color="muted">
                {crumb.map((p, i) => (i === 0 && p.icon ? p.icon + ' ' : '') + p.title).join(' / ')}
              </Txt>
              {isEditing ? (
                <TextInput
                  value={editing.title}
                  onChangeText={(v) => setEditing((e) => (e ? { ...e, title: v } : e))}
                  maxLength={120}
                  aria-label="Sayfa başlığı"
                  style={[{ fontSize: 28, fontWeight: '800', color: colors.text, fontFamily: 'Urbanist', paddingVertical: 2 }, { outlineStyle: 'none' } as object]}
                />
              ) : (
                <Txt size={28} weight={800} leading={1.15}>
                  {page.title}
                </Txt>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {editor_ && <PresenceAvatar person={editor_} size={20} isMe={false} ring={colors.surface} dot={false} />}
                <Txt size={12} color="muted">
                  Son düzenleyen {editor_?.full_name ?? 'biri'} · {timeAgo(page.updated_at)}
                </Txt>
                {canDelete && !isEditing && (
                  <Press onPress={remove} style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Txt size={12} weight={700} color="muted">
                      Sil
                    </Txt>
                  </Press>
                )}
              </View>
              {other && (
                <Notice>{`Bu sayfa ${team.nameOf(other)} tarafından düzenleniyor. Aynı anda kaydederseniz biriniz uyarı alır.`}</Notice>
              )}
              {conflict !== false && (
                <Notice>
                  {`Sen düzenlerken ${conflict ? team.nameOf(conflict) : 'biri'} bu sayfayı kaydetti. Onun yazdığı silinmesin diye kaydetmedim.`}
                </Notice>
              )}
              {conflict !== false && (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <Btn
                    label="Onun sürümünü aç (benimkini bırak)"
                    onPress={() => {
                      setEditing(null);
                      setConflict(false);
                    }}
                  />
                  <Btn label="Benimkini kaydet (onunki geçmişte kalır)" onPress={() => finish(true)} primary />
                </View>
              )}
              <WikiEditor
                key={page.id + (isEditing ? ':e' : ':v')}
                ref={editor}
                content={page.content}
                editable={isEditing}
                pageId={page.id}
                onFail={say}
              />
              {history && <History page={page} onClose={() => setHistory(false)} />}
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

function Btn({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const { colors } = useTheme();
  return (
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
}

function Notice({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 10, borderRadius: 12, backgroundColor: `color-mix(in srgb, ${colors.a1} 14%, transparent)`, marginBottom: 8 }}>
      <Txt size={13} weight={700}>
        {children}
      </Txt>
    </View>
  );
}

function History({ page, onClose }: { page: WikiPage; onClose: () => void }) {
  const { colors } = useTheme();
  const team = useTeam();
  const say = useToast();
  const revs = useRevisions(page.id);
  return (
    <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderColor: colors.line, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Txt size={11} weight={800} color="muted" style={{ letterSpacing: 0.88, textTransform: 'uppercase', flex: 1 }}>
          Sayfa geçmişi
        </Txt>
        <Press onPress={onClose}>
          <Txt size={12} weight={700} color="muted">
            Kapat
          </Txt>
        </Press>
      </View>
      {revs.loading ? (
        <Txt color="muted">Yükleniyor…</Txt>
      ) : !revs.data?.length ? (
        <Txt size={13} color="muted">
          Henüz eski sürüm yok.
        </Txt>
      ) : (
        <ScrollView style={{ maxHeight: 280 }}>
          {revs.data.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.line }}>
              <Txt size={13} weight={700} style={{ width: 40 }}>
                v{r.version}
              </Txt>
              <Txt size={13} color="text-2" numberOfLines={1} style={{ flex: 1 }}>
                {r.title} · {team.nameOf(r.edited_by)} · {timeAgo(r.created_at)}
              </Txt>
              <Press
                onPress={async () => {
                  try {
                    await restoreRevision(page.id, r.id);
                    say(`v${r.version} geri yüklendi`);
                  } catch {
                    say('Geri yüklenemedi');
                  }
                }}
                style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.chip }}
              >
                <Txt size={12} weight={800}>
                  Geri yükle
                </Txt>
              </Press>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
