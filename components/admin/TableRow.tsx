import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Box } from '@/components/ui/Box';
import { Txt } from '@/components/ui/Txt';

/** Tablo satırı; telefonda yatay kaydırılır. */
export function TableRow({ cells, header, first }: { cells: { w: number; node: ReactNode; right?: boolean }[]; header?: boolean; first?: boolean }) {
  return (
    <Box
      border={first ? undefined : 'line'}
      style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 0, borderTopWidth: first ? 0 : 1, paddingVertical: header ? 10 : 12 }}
    >
      {cells.map((c, i) => (
        <View key={i} style={{ width: c.w, paddingHorizontal: 8, alignItems: c.right ? 'flex-end' : 'flex-start' }}>
          {header && typeof c.node === 'string' ? (
            <Txt size={12.5} weight={700} color="muted" style={{ letterSpacing: 0.6 }}>
              {c.node.toLocaleUpperCase('tr')}
            </Txt>
          ) : (
            c.node
          )}
        </View>
      ))}
    </Box>
  );
}
