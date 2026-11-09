import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsWide } from '@/components/layout/useIsWide';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Ekran okuyucu için başlık. */
  label: string;
};

/**
 * Açılır panel. Telefonda alttan kayan sayfa (Main.dc.html .sheet),
 * geniş ekranda ortada pencere (Desktop.dc.html .dialog). Boşluğa basınca kapanır.
 */
export function Sheet({ open, onClose, children, label }: Props) {
  const { colors } = useTheme();
  const motion = useMotion();
  const wide = useIsWide();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.scrim },
          motion.colors,
          motion.fade(wide ? 250 : 280),
          wide
            ? { alignItems: 'center', justifyContent: 'center', padding: 24 }
            : { justifyContent: 'flex-end' },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Kapat" />
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={label}
          role="dialog"
          style={[
            { backgroundColor: colors.surface },
            motion.colors,
            wide
              ? {
                  width: '100%',
                  maxWidth: 520,
                  maxHeight: '88%',
                  borderRadius: 28,
                  boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
                }
              : { width: '100%', maxHeight: '92%', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
            wide ? motion.dialog() : motion.sheet(),
          ]}
        >
          <ScrollView
            contentContainerStyle={
              wide
                ? { padding: 26, gap: 14 }
                : { padding: 20, paddingTop: 12, paddingBottom: 28 + insets.bottom, gap: 14 }
            }
            showsVerticalScrollIndicator={false}
          >
            {!wide && (
              <View
                style={{
                  alignSelf: 'center',
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors['line-2'],
                }}
              />
            )}
            {children}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
