// Pencere, panel ve menüleri sayfanın dışına (body'ye) taşır. Sayfa içindeki animasyonlu (transform'lu) bir
// kutunun içinde "position: fixed" ekrana değil o kutuya göre yerleşir; önizleme ince bir şeride sıkışıyordu.

import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { createPortal } from 'react-dom';

export function Portal({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return <>{children}</>;
  return createPortal(children, document.body);
}
