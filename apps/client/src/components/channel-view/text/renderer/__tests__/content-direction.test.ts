import type { TJoinedMessage } from '@sharkord/shared';
import { expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('../serializer', () => ({ serializer: () => undefined }));
const { getParsedMessageHtml } = await import('../content-cache');

test('mixed Persian and Arabic paragraphs choose direction independently', () => {
  const message = {
    id: 1001,
    content:
      '<p>سلام Google دنیا</p><p>English first, ثم العربية</p><p>مرحبا <a href="https://example.com/path?q=1">Example.com</a> بالعالم</p><pre><code>const name = "سلام";</code></pre>'
  } as TJoinedMessage;

  const html = renderToStaticMarkup(getParsedMessageHtml(message));

  expect(html).toContain('<p dir="auto">سلام Google دنیا</p>');
  expect(html).toContain('<p dir="auto">English first, ثم العربية</p>');
  expect(html).toContain(
    '<a href="https://example.com/path?q=1" dir="auto">Example.com</a>'
  );
  expect(html).toContain(
    '<pre><code>const name = &quot;سلام&quot;;</code></pre>'
  );
});
