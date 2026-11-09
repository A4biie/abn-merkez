import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsWide } from '@/components/layout/useIsWide';
import { css, EASE_OUT, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Txt';

const ToastContext = createContext<(msg: string) => void>(() => {});

// Prototipteki toastIn: aşağıdan hafif yaylanarak gelir.
const toastIn = css.keyframes({
  '0%': { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.96 }] },
  '60%': { opacity: 1, transform: [{ translateY: -3 }, { scale: 1.01 }] },
  '100%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});

/** Kısa onay mesajları ("Paylaşıldı", "Görev artık sende"). 2.4 sn sonra kaybolur. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const wide = useIsWide();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ msg: string; n: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = useCallback((msg: string) => {
    clearTimeout(timer.current);
    setToast((t) => ({ msg, n: (t?.n ?? 0) + 1 }));
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={say}>
      {children}
      {toast && (
        <View
          pointerEvents="none"
          style={
            wide
              ? { position: 'absolute', right: 28, bottom: 28, maxWidth: 360 }
              : { position: 'absolute', left: 20, right: 20, bottom: 92 + insets.bottom }
          }
        >
          <Animated.View
            key={toast.n}
            role="status"
            style={[
              {
                backgroundColor: colors['sel-bg'],
                borderRadius: 16,
                paddingVertical: wide ? 13 : 12,
                paddingHorizontal: wide ? 18 : 16,
                boxShadow: wide ? '0 14px 40px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.25)',
              },
              motion.reduced
                ? null
                : {
                    animationName: toastIn,
                    animationDuration: 420,
                    animationTimingFunction: EASE_OUT,
                    animationFillMode: 'both',
                  },
            ]}
          >
            <Txt size={14.5} weight={600} color="sel-fg" style={{ textAlign: wide ? 'left' : 'center' }}>
              {toast.msg}
            </Txt>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
