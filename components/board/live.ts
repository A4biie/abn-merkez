import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { BoardWithItems, ItemData } from '@/lib/board';
import type { Camera } from './camera';
import type { CapKind, Rect } from './geometry';

// UI iş parçacığında tutulan, her karede okunan durum. React sadece parmak kalkınca güncellenir.

/** rs: boyutlandırma (0 yok, 1 oranı koruyarak: fotoğraf/video, 2 serbest: not). */
export type LiveRect = Rect & { id: string; zone: number; rs: number };
export type LiveLink = {
  id: string;
  from: string;
  to: string;
  bx: number;
  by: number;
  s: CapKind;
  e: CapKind;
};

export type Live = {
  cam: Camera;
  rects: SharedValue<LiveRect[]>;
  links: SharedValue<LiveLink[]>;
  /** Sürüklenen kart */
  drag: { id: SharedValue<string>; x: SharedValue<number>; y: SharedValue<number>; ox: SharedValue<number>; oy: SharedValue<number> };
  /** Birlikte taşınan diğer seçili kartlar (çoklu seçim). */
  group: SharedValue<string[]>;
  /** Boyutlandırılan bölge */
  rz: SharedValue<{ id: string; x: number; y: number; w: number; h: number }>;
  /** Eğilen bağlantı */
  bend: SharedValue<{ id: string; x: number; y: number }>;
  /** Çizilmekte olan bağlantı: başlangıç kartı, parmağın dünya konumu, üstünde durulan kart */
  tmp: SharedValue<{ from: string; x: number; y: number; hover: string }>;
  selLink: SharedValue<string>;
};

/** Kartın o anki dikdörtgeni (sürükleme ve boyutlandırma dahil). */
export function liveRect(live: Live, id: string): Rect | null {
  'worklet';
  const list = live.rects.get();
  let r: LiveRect | null = null;
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      r = list[i];
      break;
    }
  }
  if (!r) return null;
  let { x, y, w, h } = r;
  if (live.drag.id.get() === id) {
    x = live.drag.x.get();
    y = live.drag.y.get();
  }
  const rz = live.rz.get();
  if (rz.id === id) {
    w = rz.w;
    h = rz.h;
  }
  return { x, y, w, h };
}

/** Kart gövdelerinin ihtiyaç duyduğu işler. */
export type BoardCtx = {
  live: Live;
  boardId: string;
  boards: BoardWithItems[];
  readOnly: boolean;
  /** Kart içindeki düğmeye basıldı: bu dokunuş "ikinci dokunuş = yazma" sayılmasın. */
  soft: () => void;
  onData: (id: string, patch: ItemData) => void;
  onWidth: (id: string, w: number) => void;
  openBoard: (boardId: string) => void;
};

export const BoardContext = createContext<BoardCtx | null>(null);

export function useBoardCtx() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoardCtx, BoardContext içinde kullanılmalı.');
  return ctx;
}
