import {
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  Urbanist_800ExtraBold,
} from '@expo-google-fonts/urbanist';

export const FONT_ASSETS = {
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  Urbanist_800ExtraBold,
};

export type Weight = 400 | 500 | 600 | 700 | 800;

// Android'de kalınlık fontWeight ile değil, ayrı yazı tipi dosyasıyla seçilir.
const FAMILY: Record<Weight, keyof typeof FONT_ASSETS> = {
  400: 'Urbanist_400Regular',
  500: 'Urbanist_500Medium',
  600: 'Urbanist_600SemiBold',
  700: 'Urbanist_700Bold',
  800: 'Urbanist_800ExtraBold',
};

export function fontFamily(weight: Weight = 400) {
  return FAMILY[weight];
}
