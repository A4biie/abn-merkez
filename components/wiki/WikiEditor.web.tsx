// Wiki içerik düzenleyicisi (webde TipTap). Başlık, liste, kalın / italik, görsel, renk kutucukları ve bilgi kutusu.
// Okurken de aynı bileşen (editable: false) kullanılır; böylece içerik her zaman şemadan geçerek çizilir.

import Image from '@tiptap/extension-image';
import { EditorContent, mergeAttributes, Node, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

import { uploadWikiImage, wikiImageUrl } from '@/lib/wiki';
import { useTheme } from '@/theme/ThemeProvider';

export type WikiEditorHandle = { html: () => string };

// ── Görsel: gizli kovadaki yol data-path'te; gösterirken imzalı adres alınır. ──
function ImageView({ node }: NodeViewProps) {
  const path = node.attrs.path as string | null;
  const [src, setSrc] = useState<string>((node.attrs.src as string) || '');
  useEffect(() => {
    if (path) wikiImageUrl(path).then(setSrc);
  }, [path]);
  return (
    <NodeViewWrapper as="figure" style={{ margin: '12px 0' }}>
      {src ? <img src={src} alt="" style={{ maxWidth: '100%', borderRadius: 12, display: 'block' }} /> : <div style={{ height: 120, borderRadius: 12, opacity: 0.3, background: 'currentColor' }} />}
    </NodeViewWrapper>
  );
}
const WikiImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      path: { default: null, parseHTML: (el) => el.getAttribute('data-path'), renderHTML: (a) => (a.path ? { 'data-path': a.path } : {}) },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

// ── Bilgi kutusu (callout) ──
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  addAttributes: () => ({ emoji: { default: '📌', parseHTML: (el) => el.getAttribute('data-emoji') || '📌' } }),
  parseHTML: () => [{ tag: 'div[data-callout]' }],
  renderHTML: ({ HTMLAttributes, node }) => ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', 'data-emoji': node.attrs.emoji, class: 'callout' }), 0],
  addNodeView() {
    return ReactNodeViewRenderer(({ node }: NodeViewProps) => (
      <NodeViewWrapper className="callout">
        <span contentEditable={false}>{node.attrs.emoji as string}</span>
        <NodeViewContent as="div" style={{ flex: 1 }} />
      </NodeViewWrapper>
    ));
  },
});

// ── Renk kutucukları (stil rehberi) ──
const Swatches = Node.create({
  name: 'swatches',
  group: 'block',
  atom: true,
  addAttributes: () => ({
    colors: {
      default: [] as string[],
      parseHTML: (el) => (el.getAttribute('data-colors') || '').split(',').filter((c) => /^#[0-9a-f]{6}$/i.test(c)),
      renderHTML: (a) => ({ 'data-colors': (a.colors as string[]).join(',') }),
    },
  }),
  parseHTML: () => [{ tag: 'div[data-swatches]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-swatches': '', class: 'swatches' })],
  addNodeView() {
    return ReactNodeViewRenderer(({ node }: NodeViewProps) => (
      <NodeViewWrapper className="swatches">
        {(node.attrs.colors as string[]).map((c) => (
          <span key={c}>
            <i style={{ background: c }} />
            {c.toUpperCase()}
          </span>
        ))}
      </NodeViewWrapper>
    ));
  },
});

export const WikiEditor = forwardRef<WikiEditorHandle, { content: string; editable: boolean; pageId: string; onFail?: (m: string) => void }>(function WikiEditor(
  { content, editable, pageId, onFail },
  ref,
) {
  const { colors } = useTheme();
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), WikiImage, Callout, Swatches],
    content,
    editable,
    immediatelyRender: false,
  });
  useImperativeHandle(ref, () => ({ html: () => editor?.getHTML() ?? content }), [editor, content]);
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);
  // Okurken içerik dışarıdan (canlı) değişirse göster.
  useEffect(() => {
    if (editor && !editable && editor.getHTML() !== content) editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content, editable]);

  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f || !editor) return;
      if (f.size > 10 * 1024 * 1024) return onFail?.('Görsel en fazla 10 MB olabilir');
      try {
        const path = await uploadWikiImage(pageId, f);
        editor.chain().focus().insertContent({ type: 'image', attrs: { path, src: '' } }).run();
      } catch {
        onFail?.('Görsel yüklenemedi');
      }
    };
    input.click();
  };
  const addSwatches = () => {
    const v = window.prompt('Renkler (virgülle): #1B1420, #5A4030');
    const list = (v || '').split(/[\s,]+/).map((c) => (c.startsWith('#') ? c : '#' + c)).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
    if (list.length) editor?.chain().focus().insertContent({ type: 'swatches', attrs: { colors: list } }).run();
  };

  const tb = (label: string, title: string, run: () => void, on?: boolean) => (
    <button
      key={title}
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      style={{
        padding: '5px 9px',
        borderRadius: 8,
        border: 0,
        cursor: 'pointer',
        fontFamily: 'Urbanist',
        fontWeight: 800,
        fontSize: 13,
        color: colors.text,
        background: on ? colors.chip : 'transparent',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="wiki-doc"
      style={
        {
          '--w-text2': colors['text-2'],
          '--w-muted': colors.muted,
          '--w-s2': colors.surface2,
          '--w-a1': colors.a1,
          color: colors.text,
          fontFamily: 'Urbanist',
        } as React.CSSProperties
      }
    >
      <style>{CSS}</style>
      {editable && editor && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 10, padding: 3, borderRadius: 10, background: colors.surface2, width: 'fit-content' }}>
          {tb('Başlık', 'Başlık', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
          {tb('B', 'Kalın', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
          {tb('İ', 'İtalik', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
          {tb('• Liste', 'Madde listesi', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
          {tb('1. Liste', 'Numaralı liste', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
          {tb('🖼 Görsel', 'Görsel ekle', addImage)}
          {tb('🎨 Renkler', 'Renk kutucukları', addSwatches)}
          {tb('📌 Bilgi kutusu', 'Bilgi kutusu', () => editor.chain().focus().insertContent({ type: 'callout', content: [{ type: 'text', text: 'Not' }] }).run())}
        </div>
      )}
      <div className={'wiki-content' + (editable ? ' editing' : '')}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

const CSS = `
.wiki-content{max-width:66ch;border-radius:10px;transition:box-shadow .15s}
.wiki-content.editing{box-shadow:0 0 0 2px color-mix(in srgb,var(--w-a1) 45%,transparent);padding:6px 10px;margin:-6px -10px}
.wiki-content .ProseMirror{outline:none;font-size:14.5px;line-height:1.55}
.wiki-content h2{font-size:17px;margin:18px 0 6px;font-weight:800}
.wiki-content h3{font-size:15px;margin:14px 0 4px;font-weight:800}
.wiki-content p,.wiki-content li{color:var(--w-text2);margin:4px 0}
.wiki-content ul,.wiki-content ol{padding-left:22px}
.wiki-content .callout{border-radius:12px;background:var(--w-s2);padding:10px 14px;display:flex;gap:10px;margin:10px 0}
.wiki-content .swatches{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.wiki-content .swatches span{display:flex;flex-direction:column;gap:4px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:var(--w-muted)}
.wiki-content .swatches i{width:56px;height:40px;border-radius:10px;display:block}
.wiki-content .ProseMirror-selectednode{outline:2px solid var(--w-a1);border-radius:10px}
.wiki-content p.is-editor-empty:first-child::before{content:'Yazmaya başla…';color:var(--w-muted);float:left;height:0;pointer-events:none}
`;
