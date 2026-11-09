import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field } from '@/components/ui/Controls';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { changePassword } from '@/lib/auth';

/** Kendi profilinde "Şifremi değiştir" penceresinin içi. */
export function PasswordForm({ onClose }: { onClose: () => void }) {
  const say = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (error) setError(null);
  };

  async function save() {
    if (!current || !next) return setError('Mevcut ve yeni şifreni yaz.');
    if (next !== again) return setError('Yeni şifre iki kutuda aynı değil.');
    setBusy(true);
    const e = await changePassword(current, next);
    setBusy(false);
    if (e) return setError(e);
    say('Şifren değişti. Bir dahaki girişte yenisini kullan.');
    onClose();
  }

  const secret = { secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false, style: { borderRadius: 12 } } as const;

  return (
    <View style={{ gap: 12 }}>
      <Txt size={20} weight={700}>
        Şifremi değiştir
      </Txt>
      <Field label="Mevcut şifre" placeholder="Mevcut şifre" value={current} onChangeText={edit(setCurrent)} autoComplete="current-password" {...secret} />
      <Field label="Yeni şifre" placeholder="Yeni şifre (en az 6 karakter)" value={next} onChangeText={edit(setNext)} autoComplete="new-password" {...secret} />
      <Field label="Yeni şifre tekrar" placeholder="Yeni şifre tekrar" value={again} onChangeText={edit(setAgain)} onSubmitEditing={save} autoComplete="new-password" {...secret} />
      {!!error && (
        <Txt size={14} color="warn-text" role="alert">
          {error}
        </Txt>
      )}
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
        <Button label="Vazgeç" kind="soft" onPress={onClose} />
        <Button label={busy ? 'Kaydediliyor…' : 'Şifreyi değiştir'} onPress={save} disabled={busy} />
      </View>
    </View>
  );
}
