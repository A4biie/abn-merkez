// Ayarlar > Bildirimler (launcher ve Merkez). Değerler lib/notify/prefs.ts'de; bildirim penceresi
// değişikliği "storage" olayıyla hemen alır.

import { View } from 'react-native';

import { Button, IconButton } from '@/components/ui/Controls';
import { Select, Switch } from '@/components/ui/Select';
import { Txt } from '@/components/ui/Txt';
import { isDesktop } from '@/lib/desktop';
import { SOUND_OPTIONS, setPrefs, useNotifyPrefs, type NotifyTypeKey } from '@/lib/notify/prefs';
import { blip } from '@/lib/notify/sounds';
import { useTheme } from '@/theme/ThemeProvider';

const TYPES: { key: NotifyTypeKey; label: string }[] = [
  { key: 'mesaj', label: 'Mesajlar' },
  { key: 'anma', label: 'Anmalar' },
  { key: 'kalp', label: 'Kalpler' },
  { key: 'gorev', label: 'Görevler' },
  { key: 'duyuru', label: 'Duyurular' },
  { key: 'oylama', label: 'Oylamalar' },
];

function Row({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={15} weight={700}>
          {title}
        </Txt>
        {sub ? (
          <Txt size={13} color="muted">
            {sub}
          </Txt>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function NotifySettings() {
  const { colors } = useTheme();
  const p = useNotifyPrefs();
  const test = async () => {
    if (!isDesktop) return;
    const { emit } = await import('@tauri-apps/api/event');
    emit('bildirim://deneme');
  };
  return (
    <View style={{ gap: 12 }}>
      <Txt size={17} weight={800}>
        Bildirimler
      </Txt>
      <View style={{ backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 4 }}>
        <Row title="Bildirimleri göster">
          <Switch label="Bildirimleri göster" value={p.enabled} onChange={(v) => setPrefs({ enabled: v })} />
        </Row>
        <Row title="Konum">
          <Select
            label="Konum"
            value={p.corner}
            options={[
              { value: 'sag-alt', label: 'Sağ alt' },
              { value: 'sag-ust', label: 'Sağ üst' },
            ]}
            onChange={(v) => setPrefs({ corner: v })}
          />
        </Row>
        <Row title="Ekranda kalma süresi">
          <Select
            label="Süre"
            value={String(p.duration) as '4' | '6' | '10'}
            options={[
              { value: '4', label: '4 sn' },
              { value: '6', label: '6 sn' },
              { value: '10', label: '10 sn' },
            ]}
            onChange={(v) => setPrefs({ duration: Number(v) as 4 | 6 | 10 })}
          />
        </Row>
        <Row title="Mesaj önizlemesini göster" sub='Kapalıyken kartta sadece "Yeni mesaj" yazar.'>
          <Switch label="Mesaj önizlemesi" value={p.preview} onChange={(v) => setPrefs({ preview: v })} />
        </Row>
        <Row title="Bildirim sesi">
          <Switch label="Bildirim sesi" value={p.sound} onChange={(v) => setPrefs({ sound: v })} />
        </Row>
        <Row title="Ses">
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Select
              label="Ses"
              value={p.soundStyle}
              options={SOUND_OPTIONS}
              onChange={(v) => {
                setPrefs({ soundStyle: v });
                blip('msg', true, v);
              }}
            />
            <Button
              label="Dinle"
              size="sm"
              onPress={() => {
                blip('msg', true);
                setTimeout(() => blip('mention', true), 700);
              }}
            />
          </View>
        </Row>
        <Row title="Ses seviyesi" sub={`%${p.volume}`}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <IconButton icon="minus" label="Kıs" onPress={() => setPrefs({ volume: Math.max(0, p.volume - 10) })} />
            <IconButton icon="plus" label="Aç" onPress={() => setPrefs({ volume: Math.min(100, p.volume + 10) })} />
          </View>
        </Row>
        <Row title="Tam ekranda bildirim gösterme">
          <Switch label="Tam ekranda gösterme" value={p.hideFullscreen} onChange={(v) => setPrefs({ hideFullscreen: v })} />
        </Row>
        {TYPES.map((t) => (
          <Row key={t.key} title={t.label}>
            <Switch
              label={t.label}
              value={p.types[t.key]}
              onChange={(v) => setPrefs({ types: { ...p.types, [t.key]: v } })}
            />
          </Row>
        ))}
        <View style={{ paddingVertical: 12 }}>
          <Button label="Deneme bildirimi gönder" onPress={test} />
        </View>
      </View>
    </View>
  );
}
