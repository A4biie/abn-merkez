import {
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { LogoLoader } from '@/components/LogoLoader';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { signedUrl } from '@/lib/board';
import { useTheme } from '@/theme/ThemeProvider';

/** Gizli kovadaki dosyanın imzalı adresi; yüklenirken null. */
function useSigned(path: string, bucket: 'chat-files' | 'post-files') {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    signedUrl(path, bucket)
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [path, bucket]);
  return url;
}

export function StoredImage({
  path,
  bucket,
  width,
  height,
  radius = 14,
}: {
  path: string;
  bucket: 'chat-files' | 'post-files';
  width: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  const { colors } = useTheme();
  const url = useSigned(path, bucket);
  return (
    <View
      style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.surface2 }}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          accessibilityLabel="Görsel"
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <LogoLoader size="sm" />
        </View>
      )}
    </View>
  );
}

export function formatMs(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Sesli mesaj: oynat / duraklat ve süre. */
export function VoiceMessage({ path, ms, ink }: { path: string; ms: number | null; ink: string }) {
  const url = useSigned(path, 'chat-files');
  return url ? <VoicePlayer url={url} ms={ms} ink={ink} /> : <LogoLoader size="sm" color={ink} />;
}

function VoicePlayer({ url, ms, ink }: { url: string; ms: number | null; ink: string }) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const total = (status.duration || (ms ?? 0) / 1000) * 1000;
  const elapsed = status.currentTime * 1000;
  const ended = status.didJustFinish || (total > 0 && elapsed >= total - 50);

  function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    if (ended) player.seekTo(0);
    player.play();
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 160 }}>
      <Press
        onPress={toggle}
        accessibilityLabel={status.playing ? 'Duraklat' : 'Sesli mesajı oynat'}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: ink,
        }}
      >
        <Icon name={status.playing ? 'pause' : 'play'} size={15} color={ink} fill={ink} />
      </Press>
      <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: `${ink}33`, overflow: 'hidden' }}>
        <View
          style={{
            width: `${total ? Math.min(100, (elapsed / total) * 100) : 0}%`,
            height: 3,
            backgroundColor: ink,
          }}
        />
      </View>
      <Txt size={12.5} weight={600} style={{ color: ink, fontVariant: ['tabular-nums'] }}>
        {formatMs(status.playing || elapsed > 0 ? elapsed : total)}
      </Txt>
    </View>
  );
}

/**
 * Basılı tutarak ses kaydı. start() izin ister ve kaydı başlatır; stop() kaydı bitirip
 * dosya adresini ve süreyi verir (çok kısa kayıtlar için null).
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return 'izin';
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      return null;
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    const ms = state.durationMillis;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (!recorder.uri || ms < 700) return null;
    return { uri: recorder.uri, ms };
  }

  return { start, stop, recording: state.isRecording, starting, ms: state.durationMillis };
}
