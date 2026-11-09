import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, View, type GestureResponderEvent, type ScrollViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { LogoLoader } from '@/components/LogoLoader';
import { EASE_SPRING, useMotion } from '@/theme/motion';

/** Bu kadar çekince bırakmak yenilemeyi başlatır (dış hat bu mesafede tam çizilir). */
const TRIGGER = 70;
/** Yenilerken içeriğin durduğu yükseklik. */
const HOLD = 56;

/**
 * Aşağı çekip yenile (telefon). Çektikçe yukarıdan LogoLoader iner ve dış hattı çekme mesafesine
 * göre çizilir; 70 px'te tam. Bırakınca tur atar, yenileme bitince liste yay eğrisiyle 0.5 sn'de
 * yerine döner. Dokunma olaylarıyla çalışır; fareyle (bilgisayarda) devreye girmez.
 */
export function PullToRefresh({
  onRefresh,
  children,
  ...scrollProps
}: ScrollViewProps & { onRefresh?: () => Promise<unknown>; children: ReactNode }) {
  const motion = useMotion();
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(0);
  const startY = useRef<number | null>(null);

  if (!onRefresh) return <ScrollView {...scrollProps}>{children}</ScrollView>;

  function onTouchStart(e: GestureResponderEvent) {
    if (refreshing || scrollY.current > 0) return;
    startY.current = e.nativeEvent.pageY;
  }
  function onTouchMove(e: GestureResponderEvent) {
    if (startY.current === null) return;
    const dy = e.nativeEvent.pageY - startY.current;
    if (dy <= 0 || scrollY.current > 0) {
      if (dragging) {
        setDragging(false);
        setPull(0);
      }
      return;
    }
    if (!dragging) setDragging(true);
    // Direnç: parmak 2 birim inerken liste 1 birim iner.
    setPull(Math.min(dy * 0.5, 110));
  }
  async function onTouchEnd() {
    if (startY.current === null) return;
    startY.current = null;
    setDragging(false);
    if (pull >= TRIGGER && onRefresh) {
      setRefreshing(true);
      setPull(HOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }

  const visible = pull > 4 || refreshing;
  return (
    <View style={{ flex: 1 }}>
      {visible && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8 + Math.min(pull, HOLD) * 0.35,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 2,
            opacity: Math.min(1, pull / 30),
          }}
        >
          <LogoLoader size="md" progress={refreshing ? undefined : pull / TRIGGER} label="Yenileniyor" />
        </View>
      )}
      <ScrollView
        {...scrollProps}
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
          scrollProps.onScroll?.(e);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <Animated.View
          style={[
            { transform: [{ translateY: pull }] },
            dragging || motion.reduced
              ? null
              : {
                  transitionProperty: 'transform',
                  transitionDuration: 500,
                  transitionTimingFunction: EASE_SPRING,
                },
          ]}
        >
          {children}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
