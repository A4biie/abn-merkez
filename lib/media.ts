// Görsel seçme ve yerel dosyayı yüklemeye hazırlama (sohbet ve oylama görselleri).

import * as ImagePicker from 'expo-image-picker';

import type { PickedImage } from './queries';

/** Galeriden tek görsel seçer; vazgeçilirse null. */
export async function pickImage(opts: { aspect?: [number, number] } = {}): Promise<PickedImage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !!opts.aspect,
    aspect: opts.aspect,
    quality: 0.8,
    base64: true,
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, base64: a.base64, mimeType: a.mimeType, file: a.file };
}

/** Telefonda kaydedilen dosyanın (ses kaydı) içeriği. */
export async function readLocalFile(uri: string) {
  const res = await fetch(uri);
  return new Uint8Array(await res.arrayBuffer());
}
