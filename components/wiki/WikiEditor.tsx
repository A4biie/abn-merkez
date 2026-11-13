// Telefon uygulamasında wiki sadece okunur (düzenleyici TipTap webde çalışıyor): etiketler atılıp düz metin gösterilir.

import { forwardRef, useImperativeHandle } from 'react';

import { Txt } from '@/components/ui/Txt';

export type WikiEditorHandle = { html: () => string };

const toText = (html: string) =>
  html
    .replace(/<\/(p|h2|h3|li|div)>/g, '\n')
    .replace(/<li>/g, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const WikiEditor = forwardRef<WikiEditorHandle, { content: string; editable: boolean; pageId: string; onFail?: (m: string) => void }>(function WikiEditor(
  { content },
  ref,
) {
  useImperativeHandle(ref, () => ({ html: () => content }), [content]);
  return (
    <Txt size={14.5} color="text-2">
      {toText(content) || 'Bu sayfa boş.'}
    </Txt>
  );
});
