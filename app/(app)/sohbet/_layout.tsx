import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

// Oda listesi ve oda aynı sekmede; oda üstüne itilir, geri tuşu listeye döner.
export default function Layout() {
  const { pageBg } = useTheme();
  // Telefonda (Android) yerel geçiş: detay sağdan girer, arkadaki sayfa sola kayar.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: pageBg },
        animation: 'slide_from_right',
        animationDuration: 500,
      }}
    />
  );
}
