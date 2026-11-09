import { useWindowDimensions } from 'react-native';

/** 900px ve üstü bilgisayar yerleşimi (sol menü), altı telefon yerleşimi (alt menü). */
export const WIDE_BREAKPOINT = 900;

export function useIsWide() {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}
