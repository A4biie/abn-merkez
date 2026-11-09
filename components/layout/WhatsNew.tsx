import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Box } from '@/components/ui/Box';
import { Button } from '@/components/ui/Controls';
import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';
import { RELEASES } from '@/lib/changelog';
import { APP_VERSION } from '@/lib/version';

/** Bu cihazda en son hangi sürümün "Neler yeni" paneli görüldü. */
const SEEN_KEY = 'abn.seenVersion';

/**
 * Uygulama yeni bir sürüme ilk açıldığında bir kez çıkan "Neler yeni" paneli.
 * İçerik CHANGELOG.md'deki o sürümün maddeleri (lib/changelog.ts). Kapatınca bir daha çıkmaz.
 */
export function WhatsNew() {
  const [open, setOpen] = useState(false);
  const release = RELEASES.find((r) => r.version === APP_VERSION);

  useEffect(() => {
    if (!release) return;
    let alive = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (alive && seen !== APP_VERSION) setOpen(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [release]);

  function close() {
    setOpen(false);
    AsyncStorage.setItem(SEEN_KEY, APP_VERSION).catch(() => {});
  }

  if (!release) return null;
  return (
    <Sheet open={open} onClose={close} label="Neler yeni">
      <View style={{ gap: 14 }}>
        <View style={{ gap: 4 }}>
          <Txt size={13} weight={700} color="accent-text">
            Sürüm {release.version}
          </Txt>
          <Txt size={22} weight={700} leading={1.2}>
            Neler yeni
          </Txt>
        </View>
        {release.sections.map((s) => (
          <View key={s.title} style={{ gap: 8 }}>
            {release.sections.length > 1 && (
              <Txt size={13} weight={700} color="muted">
                {s.title.toLocaleUpperCase('tr')}
              </Txt>
            )}
            {s.items.map((item) => (
              <View key={item} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Box bg="a2" style={{ width: 7, height: 7, borderRadius: 4, marginTop: 8 }} />
                <Txt size={14.5} color="text-2" style={{ flex: 1 }}>
                  {item}
                </Txt>
              </View>
            ))}
          </View>
        ))}
        <Button label="Tamam, anladım" size="lg" onPress={close} />
      </View>
    </Sheet>
  );
}
