// Hızlı fikir penceresi (Ctrl+Shift+Space). Enter kaydeder ve Fikir Defteri'ne düşer, Esc kapatır.

import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Logo } from '@/components/Logo';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { listenDesktop, windowAction } from '@/lib/desktop';
import { openMerkez } from '@/lib/launcher/merkez';
import { addIdea } from '@/lib/queries';
import { EASE_SPRING, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { pop2KF, riseIn } from './parts';

const MAX = 500;

export function QuickIdea() {
  const { colors } = useTheme();
  const motion = useMotion();
  const { profile } = useAuth();
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  // Pencere şeffaf: sayfanın koyu zemini görünmesin.
  useEffect(() => {
    for (const el of [document.documentElement, document.body, document.getElementById('root')]) {
      if (el) el.style.background = 'transparent';
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') windowAction('close');
    };
    window.addEventListener('keydown', onKey);
    const off = listenDesktop('fikir://focus', () => input.current?.focus());
    return () => {
      window.removeEventListener('keydown', onKey);
      off();
    };
  }, []);

  async function save() {
    const body = text.trim();
    if (!body || !profile || state === 'saving') return;
    setState('saving');
    const error = await addIdea(profile.id, body);
    if (error) {
      setState('error');
      return;
    }
    setState('saved');
    setTimeout(() => windowAction('close'), 900);
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'transparent',
      }}
    >
      <Animated.View
        style={[
          {
            width: '100%',
            borderRadius: 24,
            backgroundColor: colors.surface,
            padding: 16,
            gap: 10,
            boxShadow: `0 0 0 1px ${colors['line-2']}, 0 18px 40px rgba(0,0,0,0.35)`,
          },
          riseIn(motion, 0),
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Logo size={16} />
          <Txt size={12.5} weight={800} color="muted" style={{ flex: 1 }}>
            Hızlı fikir · Fikir Defteri&apos;ne düşer
          </Txt>
          <Txt size={11.5} weight={700} color="faint">
            Enter kaydet · Esc kapat
          </Txt>
        </View>
        {!profile ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
            <Txt size={15} weight={600} style={{ flex: 1 }}>
              Fikir kaydetmek için önce Merkez&apos;e giriş yap.
            </Txt>
            <Txt
              size={14}
              weight={800}
              color="accent-text"
              onPress={() => {
                openMerkez('/giris');
                windowAction('close');
              }}
            >
              Giriş yap
            </Txt>
          </View>
        ) : state === 'saved' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
            <Animated.View
              style={[
                {
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.a3,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                motion.reduced
                  ? null
                  : { animationName: pop2KF, animationDuration: 500, animationTimingFunction: EASE_SPRING },
              ]}
            >
              <Icon name="check" size={16} color={colors['a3-ink']} strokeWidth={3} />
            </Animated.View>
            <Txt size={16} weight={800}>
              Fikir Defteri&apos;ne eklendi
            </Txt>
          </View>
        ) : (
          <TextInput
            ref={input}
            autoFocus
            value={text}
            onChangeText={(v) => setText(v.slice(0, MAX))}
            onSubmitEditing={save}
            placeholder="Aklına ne geldi? Yarım cümle de olur."
            placeholderTextColor={colors.faint}
            accessibilityLabel="Hızlı fikir"
            editable={state !== 'saving'}
            style={
              {
                fontSize: 18,
                fontFamily: 'Urbanist_600SemiBold',
                color: colors.text,
                paddingVertical: 10,
                outlineStyle: 'none',
              } as object
            }
          />
        )}
        {state === 'error' && (
          <Txt size={13} color="warn-text">
            Kaydedilemedi. İnternet bağlantını kontrol edip Enter&apos;a tekrar bas.
          </Txt>
        )}
      </Animated.View>
    </View>
  );
}
