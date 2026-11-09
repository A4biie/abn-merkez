import { Image } from 'expo-image';
import { View } from 'react-native';

import { initial } from '@/lib/labels';
import { fontFamily } from '@/theme/fonts';
import { Txt } from './Txt';

type Person = { full_name: string; avatar_url: string | null; avatar_color: string };

/** Fotoğraf ya da kişinin renginde baş harf (prototipteki av() ile aynı). */
export function Avatar({ person, size = 44 }: { person: Person; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: person.avatar_color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {person.avatar_url ? (
        <Image source={{ uri: person.avatar_url }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Txt
          size={Math.round(size * 0.39)}
          weight={800}
          leading={1}
          style={{ color: '#0E0E10', fontFamily: fontFamily(800) }}
        >
          {initial(person.full_name)}
        </Txt>
      )}
    </View>
  );
}
