import { useRef, useState, type ComponentRef, type Ref } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeList } from '@/components/ThemePicker';
import { Box } from '@/components/ui/Box';
import { LogoBadge } from '@/components/Logo';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Sheet } from '@/components/ui/Sheet';
import { Stagger } from '@/components/ui/Stagger';
import { Txt } from '@/components/ui/Txt';
import { signInWithUsername } from '@/lib/auth';
import { supabaseConfigError } from '@/lib/supabase';
import { APP_VERSION } from '@/lib/version';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

export default function Giris() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(supabaseConfigError);
  const [themeOpen, setThemeOpen] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const valid = username.trim().length > 0 && password.length > 0;
  const ready = valid && !supabaseConfigError;

  function edit(set: (v: string) => void) {
    return (v: string) => {
      set(v);
      if (error && !supabaseConfigError) setError(null);
    };
  }

  async function submit() {
    if (sending || !ready) return;
    setSending(true);
    setError(null);
    const err = await signInWithUsername(username, password);
    setSending(false);
    // Başarılıysa oturum açılır ve yönlendirme kendiliğinden olur.
    if (err) {
      setError(err);
      setPassword('');
    }
  }

  return (
    <Box bg="bg" style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 24 + insets.top,
            paddingBottom: 24 + insets.bottom,
            paddingHorizontal: 20,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ position: 'absolute', top: 20 + insets.top, right: 20 }}>
            <Press
              onPress={() => setThemeOpen(true)}
              accessibilityLabel="Tema seç"
              bg="surface"
              shadow
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="palette" size={20} color={colors.text} />
            </Press>
          </View>

          <Stagger gap={22} style={{ width: '100%', maxWidth: 400 }}>
            <View style={{ alignItems: 'center', gap: 14 }}>
              <LogoBadge size={72} />
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Txt size={32} weight={600} leading={1.1} style={{ letterSpacing: -0.32 }} role="heading">
                  ABN Merkez
                </Txt>
                <Txt color="muted">Abby&apos;s Nexus ekip paneli</Txt>
              </View>
            </View>

            <Box bg="surface" shadow style={{ borderRadius: 28, padding: 22, gap: 14 }}>
              <Txt size={22} weight={700} leading={1.2}>
                Giriş yap
              </Txt>
              <Txt color="text-3">Kullanıcı adın ve şifrenle gir.</Txt>
              <LoginInput
                value={username}
                onChangeText={edit(setUsername)}
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholder="Kullanıcı adı"
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                textContentType="username"
                returnKeyType="next"
                submitBehavior="submit"
                aria-label="Kullanıcı adı"
              />
              <View>
                <LoginInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={edit(setPassword)}
                  onSubmitEditing={submit}
                  placeholder="Şifre"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  autoCorrect={false}
                  textContentType="password"
                  returnKeyType="go"
                  aria-label="Şifre"
                  style={{ paddingRight: 52 }}
                />
                <Press
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  style={{
                    position: 'absolute',
                    right: 4,
                    top: 4,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} color={colors.muted} />
                </Press>
              </View>
              {!!error && (
                <Txt size={14} color="warn-text" role="alert">
                  {error}
                </Txt>
              )}
              <Press
                onPress={submit}
                disabled={sending || !ready}
                bg={ready ? 'a1' : 'surface2'}
                style={{ borderRadius: 999, padding: 14, alignItems: 'center' }}
              >
                <Txt weight={700} color={ready ? 'a1-ink' : 'text-3'}>
                  {sending ? 'Giriş yapılıyor…' : 'Giriş yap'}
                </Txt>
              </Press>
            </Box>

            <Txt size={13} color="faint" style={{ textAlign: 'center' }}>
              Hesapları yöneticiler açar. Şifreni unutursan bir yöneticiye yaz.
            </Txt>
            <Txt size={12} color="faint" style={{ textAlign: 'center' }}>
              Sürüm {APP_VERSION}
            </Txt>
          </Stagger>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet open={themeOpen} onClose={() => setThemeOpen(false)} label="Tema seç">
        <ThemeList />
      </Sheet>
    </Box>
  );
}

function LoginInput({ style, ref, ...rest }: TextInputProps & { ref?: Ref<ComponentRef<typeof TextInput>> }) {
  const { colors } = useTheme();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.faint}
      {...rest}
      style={[
        {
          height: 52,
          borderRadius: 16,
          paddingHorizontal: 16,
          backgroundColor: colors.surface2,
          borderWidth: 1,
          borderColor: colors['line-2'],
          color: colors.text,
          fontFamily: fontFamily(500),
          fontSize: 16,
        },
        style,
      ]}
    />
  );
}
