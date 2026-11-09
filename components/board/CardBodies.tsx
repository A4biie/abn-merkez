import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Linking, Platform, Pressable, TextInput, View, type StyleProp, type TextStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { signedUrl, uploadBoardFile, type BoardItem, type ItemData } from '@/lib/board';
import { friendlyError } from '@/lib/errors';
import { fontFamily, type Weight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { useBoardCtx } from './live';
import { TINTS } from './tints';

type BodyProps = { item: BoardItem; editing: boolean; selected: boolean; fg: string };

/** Kartın içeriği; türüne göre (Board.dc.html'deki sc-if blokları). */
export function CardBody(props: BodyProps) {
  switch (props.item.type) {
    case 'note':
      return <NoteBody {...props} />;
    case 'heading':
      return <HeadingBody {...props} />;
    case 'todo':
      return <TodoBody {...props} />;
    case 'image':
      return <ImageBody {...props} />;
    case 'color':
      return <ColorBody {...props} />;
    case 'link':
      return <LinkBody {...props} />;
    case 'board':
      return <BoardBody {...props} />;
    case 'zone':
      return <ZoneBody {...props} />;
    case 'sketch':
      return <SketchBody {...props} />;
    case 'table':
      return <TableBody {...props} />;
    case 'quote':
      return <QuoteBody {...props} />;
    case 'file':
      return <FileBody {...props} />;
    case 'video':
      return <VideoBody {...props} />;
  }
}

// ───────────────────────── Ortak parçalar ─────────────────────────

/**
 * Kart içindeki düğme. Basıldığını tuvale bildirir ki bu dokunuş "seçili karta ikinci dokunuş =
 * yazma" sayılmasın. Parmak 6px'ten fazla kayarsa tuval sürüklemeyi devralır, düğme çalışmaz.
 */
function CardButton({
  onPress,
  label,
  style,
  children,
}: {
  onPress: () => void;
  label?: string;
  style?: object;
  children: ReactNode;
}) {
  const { soft } = useBoardCtx();
  return (
    <Pressable
      onPressIn={soft}
      onPress={() => {
        soft();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={style}
    >
      {children}
    </Pressable>
  );
}

/** Yazma modunda metin kutusu, değilse düz yazı. */
function InlineText({
  value,
  onChange,
  editing,
  size = 15,
  weight = 400,
  color,
  placeholder,
  multiline,
  italic,
  lineHeight,
  label,
  autoFocus,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
  size?: number;
  weight?: Weight;
  color: string;
  placeholder?: string;
  multiline?: boolean;
  italic?: boolean;
  lineHeight?: number;
  label: string;
  autoFocus?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    if (editing && autoFocus) setTimeout(() => ref.current?.focus(), 30);
  }, [editing, autoFocus]);

  const base: TextStyle = {
    fontFamily: fontFamily(weight),
    fontSize: size,
    lineHeight: lineHeight ?? Math.round(size * 1.35),
    color,
    fontStyle: italic ? 'italic' : 'normal',
    padding: 0,
  };
  if (editing) {
    const lines = multiline ? Math.max(1, value.split('\n').length + Math.floor(value.length / 34)) : 1;
    return (
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        aria-label={label}
        // @ts-expect-error dataSet sadece webde: kart içi alanlarda odak çerçevesi gizlenir
        dataSet={{ board: 'field' }}
        style={[base, multiline && { minHeight: lines * (base.lineHeight ?? 20) }, style]}
      />
    );
  }
  return (
    <Txt
      size={size}
      weight={weight}
      style={[base, !value && { color: colors.faint }, style]}
      numberOfLines={multiline ? undefined : 1}
    >
      {value || placeholder || ' '}
    </Txt>
  );
}

function useText(item: BoardItem, key: keyof ItemData = 'text') {
  const { onData } = useBoardCtx();
  const value = (item.data[key] as string | undefined) ?? '';
  return [value, (v: string) => onData(item.id, { [key]: v })] as const;
}

function openUrl(url?: string) {
  if (!url) return;
  Linking.openURL(/^https?:\/\//.test(url) ? url : `https://${url}`);
}

// ───────────────────────── Not, başlık, alıntı ─────────────────────────

function NoteBody({ item, editing, fg }: BodyProps) {
  const [text, setText] = useText(item);
  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
      <InlineText
        value={text}
        onChange={setText}
        editing={editing}
        multiline
        autoFocus
        color={fg}
        lineHeight={22}
        placeholder="Bir şey yaz…"
        label="Not"
      />
    </View>
  );
}

function HeadingBody({ item, editing, fg }: BodyProps) {
  const [text, setText] = useText(item);
  return (
    <View style={{ paddingHorizontal: 8, paddingBottom: 6 }}>
      <InlineText
        value={text}
        onChange={setText}
        editing={editing}
        autoFocus
        size={28}
        weight={800}
        color={fg}
        label="Başlık"
        style={{ letterSpacing: -0.28 }}
      />
    </View>
  );
}

function QuoteBody({ item, editing, fg }: BodyProps) {
  const { colors } = useTheme();
  const [text, setText] = useText(item);
  const [author, setAuthor] = useText(item, 'author');
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 4 }}>
      <Txt
        size={46}
        weight={800}
        leading={0.8}
        style={{ height: 26, color: colors['accent-text'] }}
        aria-hidden
      >
        “
      </Txt>
      <InlineText
        value={text}
        onChange={setText}
        editing={editing}
        multiline
        autoFocus
        italic
        size={17}
        lineHeight={24}
        color={fg}
        label="Alıntı"
      />
      <InlineText
        value={author}
        onChange={setAuthor}
        editing={editing}
        size={13.5}
        weight={600}
        color={colors.muted}
        placeholder="— Kaynak"
        label="Kaynak"
      />
    </View>
  );
}

// ───────────────────────── Yapılacaklar ─────────────────────────

function TodoBody({ item, editing, fg }: BodyProps) {
  const { colors } = useTheme();
  const { onData, readOnly, soft } = useBoardCtx();
  const [title, setTitle] = useText(item);
  const [draft, setDraft] = useState('');
  const todos = item.data.todos ?? [];

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    onData(item.id, { todos: [...todos, { text: t, done: false }] });
  };

  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 4 }}>
      <InlineText
        value={title}
        onChange={setTitle}
        editing={editing}
        autoFocus
        size={16}
        weight={700}
        color={fg}
        label="Liste başlığı"
        style={{ paddingBottom: 4 }}
      />
      {todos.map((td, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }}>
          <CardButton
            label={td.text}
            onPress={() =>
              !readOnly &&
              onData(item.id, { todos: todos.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })
            }
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: td.done ? colors.bar : colors['line-2'],
              backgroundColor: td.done ? colors.a1 : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {td.done && <Icon name="check" size={12} color={colors['a1-ink']} strokeWidth={3.4} />}
          </CardButton>
          <Txt
            size={14.5}
            style={{
              flex: 1,
              color: fg,
              textDecorationLine: td.done ? 'line-through' : 'none',
              opacity: td.done ? 0.6 : 1,
            }}
          >
            {td.text}
          </Txt>
        </View>
      ))}
      {!readOnly && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onFocus={soft}
            onSubmitEditing={add}
            placeholder="Madde ekle…"
            placeholderTextColor={colors.faint}
            aria-label="Yeni madde"
            // @ts-expect-error dataSet sadece webde
            dataSet={{ board: 'field' }}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 10,
              backgroundColor: colors.surface2,
              color: colors.text,
              fontFamily: fontFamily(400),
              fontSize: 13.5,
              paddingVertical: 7,
              paddingHorizontal: 10,
            }}
          />
          <CardButton
            label="Maddeyi ekle"
            onPress={add}
            style={{
              borderRadius: 10,
              paddingHorizontal: 10,
              justifyContent: 'center',
              backgroundColor: colors.a1,
            }}
          >
            <Txt weight={800} color="a1-ink">
              +
            </Txt>
          </CardButton>
        </View>
      )}
    </View>
  );
}

// ───────────────────────── Görsel ─────────────────────────

function useSignedUrl(path?: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (path)
      signedUrl(path)
        .then((u) => alive && setUrl(u))
        .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [path]);
  return path ? url : null;
}

async function pickedBody(asset: { uri: string; base64?: string | null; file?: File | null }) {
  if (Platform.OS === 'web') return asset.file ?? (await (await fetch(asset.uri)).blob());
  if (asset.base64) {
    const bin = atob(asset.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return await (await fetch(asset.uri)).blob();
}

function FaceArt() {
  return (
    <View
      style={{
        height: 180,
        borderRadius: 10,
        backgroundColor: '#C5B5FA',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
    >
      <Svg
        width={74}
        height={90}
        viewBox="0 0 92 112"
        fill="none"
        stroke="#0E0E10"
        strokeWidth={2.5}
        strokeLinecap="round"
      >
        <Ellipse cx={46} cy={58} rx={34} ry={44} />
        <Circle cx={33} cy={52} r={4} />
        <Circle cx={59} cy={52} r={4} />
        <Path d="M34 80q12 8 24 0" />
      </Svg>
      <Svg
        width={74}
        height={90}
        viewBox="0 0 92 112"
        fill="none"
        stroke="#0E0E10"
        strokeWidth={2.5}
        strokeLinecap="round"
      >
        <Ellipse cx={46} cy={58} rx={34} ry={44} />
        <Circle cx={33} cy={50} r={8} />
        <Circle cx={59} cy={50} r={8} />
        <Ellipse cx={46} cy={84} rx={7} ry={10} />
      </Svg>
    </View>
  );
}

function MoodArt() {
  const mood = ['#6B4E3D', '#C9A66B', '#2F3B3A', '#8C3B2E', '#E8D9B5', '#4A5A6A'];
  return (
    <View
      style={{
        height: 180,
        borderRadius: 10,
        overflow: 'hidden',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 3,
      }}
    >
      {mood.map((c) => (
        <View key={c} style={{ width: '32%', flexGrow: 1, height: '49%', backgroundColor: c }} />
      ))}
    </View>
  );
}

function ImageBody({ item, editing, fg }: BodyProps) {
  const { colors } = useTheme();
  const say = useToast();
  const { onData, readOnly, boardId } = useBoardCtx();
  const [text, setText] = useText(item);
  const [busy, setBusy] = useState(false);
  const url = useSignedUrl(item.data.path);

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: Platform.OS !== 'web',
    });
    const a = res.canceled ? null : res.assets[0];
    if (!a) return;
    setBusy(true);
    try {
      const name = a.fileName ?? a.file?.name ?? 'gorsel.jpg';
      const path = await uploadBoardFile(boardId, await pickedBody(a), name, a.mimeType ?? 'image/jpeg');
      onData(item.id, { path, text: text || name.replace(/\.[^.]+$/, '') });
    } catch (e) {
      say(friendlyError(e, 'Görsel yüklenemedi. Daha küçük bir görselle tekrar dene.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 6 }}>
      {item.data.path ? (
        url ? (
          <Image
            source={{ uri: url }}
            style={{ width: '100%', height: 180, borderRadius: 10 }}
            contentFit="cover"
            accessibilityLabel={text}
          />
        ) : (
          <View style={{ height: 180, borderRadius: 10, backgroundColor: colors.surface2 }} />
        )
      ) : item.data.art === 'face' ? (
        <FaceArt />
      ) : item.data.art === 'mood' ? (
        <MoodArt />
      ) : (
        <CardButton
          label="Görsel seç"
          onPress={() => !readOnly && !busy && pick()}
          style={{
            height: 120,
            borderRadius: 10,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors['line-2'],
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Icon name="image" size={22} color={colors.muted} />
          <Txt size={13.5} weight={600} color="muted">
            {busy ? 'Yükleniyor…' : 'Görsel seç'}
          </Txt>
        </CardButton>
      )}
      <InlineText
        value={text}
        onChange={setText}
        editing={editing}
        autoFocus
        size={13.5}
        weight={600}
        color={fg}
        placeholder="Açıklama…"
        label="Görsel açıklaması"
        style={{ paddingHorizontal: 4, paddingVertical: 2 }}
      />
    </View>
  );
}

// ───────────────────────── Renk paleti ─────────────────────────

function ColorBody({ item, editing, selected, fg }: BodyProps) {
  const { colors } = useTheme();
  const { onData, readOnly, soft } = useBoardCtx();
  const [title, setTitle] = useText(item);
  const [hex, setHex] = useState('#BC4D4B');
  const swatches = item.data.swatches ?? [];
  const valid = /^#[0-9a-fA-F]{6}$/.test(hex);

  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
      <InlineText
        value={title}
        onChange={setTitle}
        editing={editing}
        autoFocus
        weight={700}
        color={fg}
        label="Palet adı"
      />
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {swatches.map((c, i) => (
          <View key={`${c}-${i}`} style={{ alignItems: 'center', gap: 3 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: c,
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.1)',
              }}
            />
            <Txt
              size={10}
              style={{
                fontFamily: Platform.OS === 'web' ? 'ui-monospace, Menlo, monospace' : 'monospace',
                opacity: 0.8,
                color: fg,
              }}
            >
              {c}
            </Txt>
            {selected && !readOnly && (
              <CardButton
                label={`${c} rengini kaldır`}
                onPress={() => onData(item.id, { swatches: swatches.filter((_, j) => j !== i) })}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors['sel-bg'],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt size={11} leading={1} color="sel-fg">
                  ×
                </Txt>
              </CardButton>
            )}
          </View>
        ))}
      </View>
      {selected && !readOnly && (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: valid ? hex : colors.chip,
              borderWidth: 1,
              borderColor: colors['line-2'],
            }}
          />
          <TextInput
            value={hex}
            onChangeText={(v) => setHex(v.startsWith('#') ? v.slice(0, 7) : `#${v.slice(0, 6)}`)}
            onFocus={soft}
            aria-label="Renk kodu"
            autoCapitalize="characters"
            // @ts-expect-error dataSet sadece webde
            dataSet={{ board: 'field' }}
            style={{
              width: 86,
              borderRadius: 8,
              backgroundColor: colors.surface2,
              color: colors.text,
              fontFamily: fontFamily(600),
              fontSize: 13,
              paddingVertical: 6,
              paddingHorizontal: 8,
            }}
          />
          <CardButton
            label="Renk ekle"
            onPress={() => valid && onData(item.id, { swatches: [...swatches, hex.toUpperCase()] })}
            style={{
              borderRadius: 10,
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: colors.surface2,
            }}
          >
            <Txt size={12.5} weight={700}>
              Renk ekle
            </Txt>
          </CardButton>
        </View>
      )}
    </View>
  );
}

// ───────────────────────── Link, video ─────────────────────────

function LinkBody({ item, editing, fg }: BodyProps) {
  const { colors } = useTheme();
  const [title, setTitle] = useText(item);
  const [url, setUrl] = useText(item, 'url');
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingBottom: 12,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: colors.a2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="link" size={18} color={colors['a2-ink']} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <InlineText
          value={title}
          onChange={setTitle}
          editing={editing}
          autoFocus
          weight={700}
          color={fg}
          label="Link adı"
        />
        <InlineText
          value={url}
          onChange={setUrl}
          editing={editing}
          size={12.5}
          color={colors.muted}
          placeholder="adres.com"
          label="Link adresi"
        />
        {!!url && (
          <CardButton
            onPress={() => openUrl(url)}
            label="Linki aç"
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            <Txt size={12.5} weight={700} color="accent-text">
              Aç ↗
            </Txt>
          </CardButton>
        )}
      </View>
    </View>
  );
}

function VideoBody({ item, editing, fg }: BodyProps) {
  const { colors } = useTheme();
  const [title, setTitle] = useText(item);
  const [url, setUrl] = useText(item, 'url');
  return (
    <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 6 }}>
      <CardButton
        label="Videoyu aç"
        onPress={() => openUrl(url)}
        style={{
          height: 150,
          borderRadius: 10,
          backgroundColor: '#15151A',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: colors.a1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d="M8 5v14l11-7z" fill={colors['a1-ink']} />
          </Svg>
        </View>
      </CardButton>
      <InlineText
        value={title}
        onChange={setTitle}
        editing={editing}
        autoFocus
        size={14.5}
        weight={700}
        color={fg}
        label="Video adı"
        style={{ paddingHorizontal: 4 }}
      />
      <InlineText
        value={url}
        onChange={setUrl}
        editing={editing}
        size={12.5}
        color={colors.muted}
        placeholder="youtube.com/…"
        label="Video adresi"
        style={{ paddingHorizontal: 4 }}
      />
    </View>
  );
}

// ───────────────────────── Alt pano ─────────────────────────

function BoardBody({ item, editing, fg }: BodyProps) {
  const { boards, openBoard } = useBoardCtx();
  const [title, setTitle] = useText(item);
  const child = boards.find((b) => b.id === item.data.board_id);
  const count = child ? (child.items.length ? `${child.items.length} öğe` : 'Boş pano') : '';
  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: 'rgba(0,0,0,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="pano" size={20} color={fg} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <InlineText
            value={title}
            onChange={setTitle}
            editing={editing}
            autoFocus
            size={16}
            weight={800}
            color={fg}
            label="Pano adı"
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt size={13} weight={600} style={{ color: fg, opacity: 0.8 }}>
          {count}
        </Txt>
        {item.data.board_id && (
          <CardButton
            label={`${title} panosunu aç`}
            onPress={() => item.data.board_id && openBoard(item.data.board_id)}
            style={{
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 12,
              backgroundColor: 'rgba(0,0,0,0.14)',
            }}
          >
            <Txt size={13} weight={700} style={{ color: fg }}>
              Aç →
            </Txt>
          </CardButton>
        )}
      </View>
    </View>
  );
}

// ───────────────────────── Bölge ─────────────────────────

function ZoneBody({ item, editing, selected }: BodyProps) {
  const { colors } = useTheme();
  const [title, setTitle] = useText(item);
  const tint = item.color === 'surface' ? colors['text-3'] : colors[TINTS[item.color].bg];
  return (
    <>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', inset: 0, borderRadius: 16, backgroundColor: tint, opacity: 0.16 }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: tint,
        }}
      />
      <View style={{ paddingHorizontal: 14 }}>
        <InlineText
          value={title}
          onChange={setTitle}
          editing={editing}
          autoFocus
          size={18}
          weight={800}
          color={colors.text}
          label="Bölge adı"
        />
      </View>
      {selected && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            width: 22,
            height: 22,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Bölgeyi boyutlandır"
        >
          <Svg
            width={14}
            height={14}
            viewBox="0 0 14 14"
            fill="none"
            stroke={colors.muted}
            strokeWidth={2}
            strokeLinecap="round"
          >
            <Path d="M13 5 5 13M13 10l-3 3" />
          </Svg>
        </View>
      )}
    </>
  );
}

// ───────────────────────── Çizim ─────────────────────────

function sketchPath(strokes: number[][][]) {
  return (
    strokes
      .map((st) =>
        st.length === 1 ? `M${st[0][0]} ${st[0][1]}l0.1 0` : `M${st.map((p) => `${p[0]} ${p[1]}`).join('L')}`,
      )
      .join('') || 'M0 0'
  );
}

function SketchBody({ item, editing }: BodyProps) {
  const { colors } = useTheme();
  const { onData, live } = useBoardCtx();
  const [layoutW, setLayoutW] = useState(1);
  // Çizerken çizgiler yerelde tutulur; parmak kalkınca kaydedilir. Yazma modu dışında kayıtlı hali görünür.
  const [local, setLocal] = useState<number[][][] | null>(null);
  const strokes = editing && local ? local : (item.data.strokes ?? []);
  const setStrokes = setLocal;
  const vbW = item.w - 20;
  const drawing = useRef<number[][][]>([]);

  const toPt = (x: number, y: number) => {
    // Webde olay koordinatı ekrandaki (yakınlaştırılmış) boyuttadır, telefonda kartın kendi boyutunda.
    const s = Platform.OS === 'web' ? live.cam.zoom.get() : 1;
    return [Math.round((((x / s) * vbW) / layoutW) * 10) / 10, Math.round((y / s) * 10) / 10];
  };

  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    enabled: editing,
    onBegin: (e) => {
      drawing.current = [...(local ?? item.data.strokes ?? []), [toPt(e.x, e.y)]];
      setStrokes(drawing.current);
    },
    onUpdate: (e) => {
      const st = drawing.current.slice();
      const last = st[st.length - 1];
      if (!last) return;
      const p = toPt(e.x, e.y);
      const q = last[last.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 1.5) return;
      st[st.length - 1] = [...last, p];
      drawing.current = st;
      setStrokes(st);
    },
    onFinalize: () => onData(item.id, { strokes: drawing.current }),
  });

  const hint = editing
    ? 'Parmağınla ya da fareyle çiz'
    : strokes.length
      ? ''
      : 'Çizmek için karta iki kez dokun';

  return (
    <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 6 }}>
      <GestureDetector gesture={pan}>
        <View
          onLayout={(e) => setLayoutW(e.nativeEvent.layout.width || 1)}
          style={
            {
              height: 200,
              borderRadius: 10,
              backgroundColor: colors.surface2,
              overflow: 'hidden',
              cursor: editing ? 'crosshair' : undefined,
            } as object
          }
          accessibilityLabel="Çizim"
        >
          <Svg width="100%" height={200} viewBox={`0 0 ${vbW} 200`} pointerEvents="none">
            <Path
              d={sketchPath(strokes)}
              fill="none"
              stroke={colors.text}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 }}>
        <Txt size={12.5} color="muted" style={{ flex: 1 }}>
          {hint}
        </Txt>
        {editing && (
          <CardButton
            label="Çizimi temizle"
            onPress={() => {
              drawing.current = [];
              setStrokes([]);
              onData(item.id, { strokes: [] });
            }}
            style={{
              borderRadius: 999,
              paddingVertical: 5,
              paddingHorizontal: 10,
              backgroundColor: colors.chip,
            }}
          >
            <Txt size={12.5} weight={700}>
              Temizle
            </Txt>
          </CardButton>
        )}
      </View>
    </View>
  );
}

// ───────────────────────── Tablo ─────────────────────────

function TableBody({ item, editing, fg }: BodyProps) {
  const { colors } = useTheme();
  const { onData, onWidth, readOnly } = useBoardCtx();
  const rows = item.data.rows ?? [['']];
  const cols = rows[0]?.length ?? 1;

  const setCell = (r: number, k: number, v: string) => {
    const next = rows.map((x) => x.slice());
    next[r][k] = v;
    onData(item.id, { rows: next });
  };

  return (
    <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 6 }}>
      <View
        style={{
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderColor: colors['line-2'],
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.map((v, k) => (
              <View
                key={k}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 34,
                  justifyContent: 'center',
                  borderRightWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: colors['line-2'],
                  backgroundColor: r === 0 ? colors.surface2 : 'transparent',
                  paddingHorizontal: 8,
                }}
              >
                <InlineText
                  value={v}
                  onChange={(t) => setCell(r, k, t)}
                  editing={editing}
                  autoFocus={r === 0 && k === 0}
                  size={13.5}
                  weight={r === 0 ? 700 : 400}
                  color={fg}
                  label="Tablo hücresi"
                />
              </View>
            ))}
          </View>
        ))}
      </View>
      {!readOnly && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <CardButton
            label="Satır ekle"
            onPress={() => onData(item.id, { rows: [...rows, rows[0].map(() => '')] })}
            style={{
              borderRadius: 999,
              paddingVertical: 5,
              paddingHorizontal: 10,
              backgroundColor: colors.surface2,
            }}
          >
            <Txt size={12.5} weight={700}>
              + Satır
            </Txt>
          </CardButton>
          <CardButton
            label="Sütun ekle"
            onPress={() => {
              if (cols >= 6) return;
              onData(item.id, { rows: rows.map((x, r) => [...x, r === 0 ? 'Başlık' : '']) });
              onWidth(item.id, Math.max(item.w, (cols + 1) * 92));
            }}
            style={{
              borderRadius: 999,
              paddingVertical: 5,
              paddingHorizontal: 10,
              backgroundColor: colors.surface2,
            }}
          >
            <Txt size={12.5} weight={700}>
              + Sütun
            </Txt>
          </CardButton>
        </View>
      )}
    </View>
  );
}

// ───────────────────────── Dosya ─────────────────────────

function FileBody({ item, editing, fg }: BodyProps) {
  const { colors } = useTheme();
  const say = useToast();
  const { onData, readOnly, boardId } = useBoardCtx();
  const [name, setName] = useText(item);
  const [busy, setBusy] = useState(false);
  const has = !!item.data.path;
  const dot = name.lastIndexOf('.');
  const ext = has && dot > 0 ? name.slice(dot + 1, dot + 5).toUpperCase() : 'DOSYA';
  const size = item.data.size ?? 0;
  const info = !has
    ? 'Henüz dosya seçilmedi'
    : size > 1048576
      ? `${(size / 1048576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(size / 1024))} KB`;

  async function pick() {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      base64: false,
    });
    const a = res.canceled ? null : res.assets[0];
    if (!a) return;
    if ((a.size ?? 0) > 50 * 1024 * 1024) {
      say('Dosya 50 MB’tan büyük olamaz.');
      return;
    }
    setBusy(true);
    try {
      const body = Platform.OS === 'web' && a.file ? a.file : await (await fetch(a.uri)).blob();
      const mime = a.mimeType ?? 'application/octet-stream';
      const path = await uploadBoardFile(boardId, body, a.name, mime);
      onData(item.id, { path, text: a.name, size: a.size ?? 0, mime });
    } catch (e) {
      say(friendlyError(e, 'Dosya yüklenemedi. Biraz sonra tekrar dene.'));
    } finally {
      setBusy(false);
    }
  }

  async function open() {
    if (!item.data.path) return;
    try {
      Linking.openURL(await signedUrl(item.data.path));
    } catch (e) {
      say(friendlyError(e, 'Dosya açılamadı.'));
    }
  }

  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <View
          style={{
            width: 44,
            height: 52,
            borderRadius: 10,
            backgroundColor: colors.a3,
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: 6,
          }}
        >
          <Txt size={10.5} weight={800} color="a3-ink">
            {ext}
          </Txt>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <InlineText
            value={name}
            onChange={setName}
            editing={editing}
            autoFocus
            size={14.5}
            weight={700}
            color={fg}
            label="Dosya adı"
          />
          <Txt size={12.5} color="muted">
            {info}
          </Txt>
        </View>
        {has && (
          <CardButton
            label="Dosyayı aç"
            onPress={open}
            style={{
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: colors.surface2,
            }}
          >
            <Txt size={12.5} weight={700}>
              Aç ↗
            </Txt>
          </CardButton>
        )}
      </View>
      {!has && !readOnly && (
        <CardButton
          label="Dosya seç"
          onPress={() => !busy && pick()}
          style={{
            borderRadius: 10,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors['line-2'],
            padding: 10,
            alignItems: 'center',
          }}
        >
          <Txt size={13} weight={600} color="muted">
            {busy ? 'Yükleniyor…' : 'Dosya seç'}
          </Txt>
        </CardButton>
      )}
    </View>
  );
}
