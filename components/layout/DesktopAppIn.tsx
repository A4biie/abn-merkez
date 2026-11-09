import { useEffect, useState, type ReactNode } from 'react';
import Animated from 'react-native-reanimated';

import { isDesktop } from '@/lib/desktop';
import { css, EASE_OUT, useMotion } from '@/theme/motion';

// design/abn-animasyonlar.html → @keyframes appIn: opacity 0 / scale .97 → görünür, 0.6 sn, var(--out).
const appIn = css.keyframes({
  from: { opacity: 0, transform: [{ scale: 0.97 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
});

/**
 * ABN Launcher'da açılış penceresi kapanırken (lwOff'un 450. ms'si) ana pencere görünür ve
 * "launcher://app-in" olayı gelir; içerik appIn ile belirir. Web ve telefonda hiçbir şey yapmaz.
 */
export function DesktopAppIn({ children }: { children: ReactNode }) {
  const motion = useMotion();
  const [play, setPlay] = useState(0);

  useEffect(() => {
    if (!isDesktop) return;
    let off: (() => void) | undefined;
    let alive = true;
    import('@tauri-apps/api/event')
      .then(({ listen }) => listen('launcher://app-in', () => setPlay((n) => n + 1)))
      .then((un) => {
        if (alive) off = un;
        else un();
      })
      .catch(() => {});
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  if (!isDesktop) return <>{children}</>;
  return (
    <Animated.View
      key={play}
      style={[
        { flex: 1 },
        play > 0 && !motion.reduced
          ? {
              animationName: appIn,
              animationDuration: 600,
              animationTimingFunction: EASE_OUT,
              animationFillMode: 'both',
            }
          : null,
      ]}
    >
      {children}
    </Animated.View>
  );
}
