import { css, cubicBezier, useReducedMotion } from 'react-native-reanimated';
import type { CSSAnimationProperties, CSSTransitionProperties } from 'react-native-reanimated';

export { css };

// prototype/Main.dc.html ve Desktop.dc.html içindeki @keyframes ve geçişlerin karşılıkları.
// Reanimated 4'ün CSS animasyonları hem webde hem Android'de aynı çalışır.

// 0.7.0: ortak "out" eğrisi (lib/motion.ts → CURVE.out) cubic-bezier(.22,1,.36,1).
export const EASE_OUT = cubicBezier(0.22, 1, 0.36, 1);
export const EASE_SPRING = cubicBezier(0.34, 1.5, 0.6, 1);
export const EASE_IO = cubicBezier(0.65, 0, 0.35, 1);
export const EASE_SHEET = cubicBezier(0.2, 0.95, 0.25, 1);
export const EASE_DIALOG = cubicBezier(0.2, 0.9, 0.25, 1);
export const EASE_BOUNCE = cubicBezier(0.34, 1.45, 0.5, 1);
export const EASE_SPIN = cubicBezier(0.3, 1.4, 0.5, 1);
export const EASE_POP = cubicBezier(0.3, 1.6, 0.5, 1);

export const KF = {
  enter: css.keyframes({
    from: { opacity: 0, transform: [{ translateY: 16 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  }),
  push: css.keyframes({
    from: { opacity: 0, transform: [{ translateX: 28 }] },
    to: { opacity: 1, transform: [{ translateX: 0 }] },
  }),
  fade: css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }),
  /** Detay sayfası sağdan girer. */
  pageIn: css.keyframes({
    from: { transform: [{ translateX: '100%' }] },
    to: { transform: [{ translateX: 0 }] },
  }),
  sheetUp: css.keyframes({
    from: { transform: [{ translateY: '100%' }] },
    to: { transform: [{ translateY: 0 }] },
  }),
  dialogIn: css.keyframes({
    from: { opacity: 0, transform: [{ translateY: 12 }, { scale: 0.97 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  }),
  spinIn: css.keyframes({
    from: { opacity: 0, transform: [{ rotate: '-120deg' }, { scale: 0.5 }] },
    to: { opacity: 1, transform: [{ rotate: '0deg' }, { scale: 1 }] },
  }),
  ring: css.keyframes({
    from: { opacity: 0.55, transform: [{ scale: 1 }] },
    to: { opacity: 0, transform: [{ scale: 3.5 }] },
  }),
};

type Anim = CSSAnimationProperties | Record<string, never>;

/** "Hareketi azalt" açıksa bütün animasyon ve geçişler kapanır. */
export function useMotion() {
  const reduced = useReducedMotion();

  return {
    reduced,
    /** Sıralı belirme: 16 px alttan, 60 ms arayla, 450 ms'de yerine oturur (en fazla 8 adım gecikme). */
    enter(index = 0): Anim {
      if (reduced) return {};
      return {
        animationName: KF.enter,
        animationDuration: 450,
        animationDelay: Math.min(index, 8) * 60,
        animationTimingFunction: EASE_OUT,
        animationFillMode: 'both',
      };
    },
    /** .pushin > * : alt sayfaya geçerken soldan itme. */
    push(index = 0): Anim {
      if (reduced) return {};
      return {
        animationName: KF.push,
        animationDuration: 450,
        animationDelay: Math.min(index, 4) * 50,
        animationTimingFunction: EASE_OUT,
        animationFillMode: 'both',
      };
    },
    fade(duration = 280): Anim {
      if (reduced) return {};
      return { animationName: KF.fade, animationDuration: duration, animationFillMode: 'both' };
    },
    /** Detay sayfası: sağdan 0.5 sn'de girer (out eğrisi). */
    page(): Anim {
      if (reduced) return {};
      return {
        animationName: KF.pageIn,
        animationDuration: 500,
        animationTimingFunction: EASE_OUT,
        animationFillMode: 'both',
      };
    },
    /** Alt sayfa aşağıdan yükselir (out eğrisi); arkası scrim ile kararır (fade). */
    sheet(): Anim {
      if (reduced) return {};
      return {
        animationName: KF.sheetUp,
        animationDuration: 460,
        animationTimingFunction: EASE_OUT,
        animationFillMode: 'both',
      };
    },
    dialog(): Anim {
      if (reduced) return {};
      return {
        animationName: KF.dialogIn,
        animationDuration: 380,
        animationTimingFunction: EASE_DIALOG,
        animationFillMode: 'both',
      };
    },
    spin(): Anim {
      if (reduced) return {};
      return {
        animationName: KF.spinIn,
        animationDuration: 500,
        animationTimingFunction: EASE_SPIN,
        animationFillMode: 'both',
      };
    },
    /** .pulse: bildirim noktasının etrafındaki halka. */
    ring(): Anim {
      if (reduced) return {};
      return {
        animationName: KF.ring,
        animationDuration: 1600,
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-out',
      };
    },
    /** Tema değişirken renklerin yumuşak geçişi (.app * { transition: ... .45s ease }). */
    colors: (reduced
      ? {}
      : {
          transitionProperty: ['backgroundColor', 'color', 'borderColor'],
          transitionDuration: 450,
          transitionTimingFunction: 'ease',
        }) as CSSTransitionProperties,
    /** Basınca küçülme ve seçili sekme göstergesi gibi transform/konum geçişleri. */
    transition(
      property: CSSTransitionProperties['transitionProperty'],
      duration: number,
      easing: CSSTransitionProperties['transitionTimingFunction'] = EASE_OUT,
    ): CSSTransitionProperties {
      if (reduced) return {};
      return { transitionProperty: property, transitionDuration: duration, transitionTimingFunction: easing };
    },
  };
}
