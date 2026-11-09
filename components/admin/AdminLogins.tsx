// Üyeler sekmesi: yeni üye açma ve kullanıcı adı / şifre değiştirme.
// Hesaplar kullanıcı adı + şifreyle girer (bkz. 20261101000500_username_login.sql); kayıt kapalı,
// hesabı yönetici açar.

import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field } from '@/components/ui/Controls';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { normalizeUsername, USERNAME_RE } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { adminCreateMember, adminSetLogin } from '@/lib/queries';
import type { Profile } from '@/lib/types';

const USERNAME_HINT = 'Küçük harf, rakam, nokta, alt çizgi ya da tire; 3-32 karakter.';

function check(username: string | null, password: string | null) {
  if (username !== null && !USERNAME_RE.test(username)) return `Kullanıcı adı uygun değil. ${USERNAME_HINT}`;
  if (password !== null && password.length < 6) return 'Şifre en az 6 karakter olmalı.';
  return null;
}

export function NewMemberSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const say = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setName('');
    setUsername('');
    setPassword('');
    setError(null);
    onClose();
  }

  async function create() {
    const user = normalizeUsername(username);
    if (!name.trim()) return setError('Kişinin adını yaz.');
    const bad = check(user, password);
    if (bad) return setError(bad);
    setBusy(true);
    const e = await adminCreateMember(user, name.trim(), password);
    setBusy(false);
    if (e) return setError(friendlyError(e));
    say(`${name.trim()} eklendi. Kullanıcı adını ve şifresini ona ilet.`);
    close();
  }

  return (
    <Sheet open={open} onClose={close} label="Yeni üye">
      <View style={{ gap: 12 }}>
        <Txt size={20} weight={700}>
          Yeni üye
        </Txt>
        <Txt color="text-3">Kişi bu kullanıcı adı ve şifreyle girer. Şifreyi ona sen ilet; sonra değiştirebilirsin.</Txt>
        <Field label="Ad" value={name} onChangeText={setName} placeholder="Ad" style={{ borderRadius: 12 }} />
        <Field
          label="Kullanıcı adı"
          value={username}
          onChangeText={setUsername}
          placeholder="Kullanıcı adı"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ borderRadius: 12 }}
        />
        <Field
          label="Şifre"
          value={password}
          onChangeText={setPassword}
          placeholder="Şifre (en az 6 karakter)"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ borderRadius: 12 }}
        />
        <Txt size={13} color="faint">
          {USERNAME_HINT}
        </Txt>
        {!!error && (
          <Txt size={14} color="warn-text" role="alert">
            {error}
          </Txt>
        )}
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
          <Button label="Vazgeç" kind="soft" onPress={close} />
          <Button label={busy ? 'Ekleniyor…' : 'Üyeyi ekle'} onPress={create} disabled={busy} />
        </View>
      </View>
    </Sheet>
  );
}

export function LoginSheet({ person, onClose }: { person: Profile | null; onClose: () => void }) {
  const say = useToast();
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setUsername(null);
    setPassword('');
    setError(null);
    onClose();
  }

  async function save() {
    if (!person) return;
    const user = username === null ? null : normalizeUsername(username);
    const newUser = user && user !== person.username ? user : null;
    const newPw = password === '' ? null : password;
    if (!newUser && !newPw) return close();
    const bad = check(newUser, newPw);
    if (bad) return setError(bad);
    setBusy(true);
    const e = await adminSetLogin(person.id, newUser, newPw);
    setBusy(false);
    if (e) return setError(friendlyError(e));
    say(newPw ? `${person.full_name} için yeni şifre kaydedildi. Ona ilet.` : 'Kullanıcı adı değişti');
    close();
  }

  return (
    <Sheet open={!!person} onClose={close} label="Giriş bilgisi">
      {person && (
        <View style={{ gap: 12 }}>
          <Txt size={20} weight={700}>
            {person.full_name} · giriş bilgisi
          </Txt>
          <Txt color="text-3">Şifreyi değiştirmek istemiyorsan boş bırak. Kişinin açık oturumları kapanmaz.</Txt>
          <Field
            label="Kullanıcı adı"
            value={username ?? person.username}
            onChangeText={setUsername}
            placeholder="Kullanıcı adı"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ borderRadius: 12 }}
          />
          <Field
            label="Yeni şifre"
            value={password}
            onChangeText={setPassword}
            placeholder="Yeni şifre (en az 6 karakter)"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ borderRadius: 12 }}
          />
          {!!error && (
            <Txt size={14} color="warn-text" role="alert">
              {error}
            </Txt>
          )}
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
            <Button label="Vazgeç" kind="soft" onPress={close} />
            <Button label={busy ? 'Kaydediliyor…' : 'Kaydet'} onPress={save} disabled={busy} />
          </View>
        </View>
      )}
    </Sheet>
  );
}
