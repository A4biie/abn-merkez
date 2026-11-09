import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

// Liste ve detay aynı sekmede; detay üstüne itilir, geri tuşu listeye döner.
export default function Layout() {
  const { colors } = useTheme();
  // Telefonda (Android) yerel geçiş: detay sağdan girer, arkadaki sayfa sola kayar.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
        animationDuration: 500,
      }}
    />
  );
}
