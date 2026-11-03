import { describe, expect, test } from 'bun:test';
import {
  collectHtmlMentions,
  collectMarkdownMentions,
  htmlToMarkdown,
  markdownToHtml,
  type THtmlMentionLookups,
  type TMarkdownMentionLookups
} from '../discord/markdown';
import { sanitizeMessageHtml } from '../sanitize-html';

const noMarkdownLookups: TMarkdownMentionLookups = {
  users: new Map(),
  roles: new Map(),
  channels: new Map(),
  emojis: new Map()
};

const noHtmlLookups: THtmlMentionLookups = {
  userSnowflakes: new Map(),
  roleSnowflakes: new Map(),
  channelSnowflakes: new Map(),
  customEmojis: new Map()
};

describe('markdown to html', () => {
  test('one paragraph per line, with formatting the sanitizer keeps', () => {
    expect(
      markdownToHtml(
        '**bold** and *italic*\nsecond `code` line',
        noMarkdownLookups
      )
    ).toBe(
      '<p><strong>bold</strong> and <em>italic</em></p><p>second <code>code</code> line</p>'
    );
  });

  test('escapes html instead of letting it through', () => {
    expect(markdownToHtml('<b>hi</b> & bye', noMarkdownLookups)).toBe(
      '<p>&lt;b&gt;hi&lt;/b&gt; &amp; bye</p>'
    );
  });

  test('code blocks keep their text untouched, formatting characters included', () => {
    expect(
      markdownToHtml('```js\nconst a = **b**;\n```', noMarkdownLookups)
    ).toBe('<pre><code>const a = **b**;</code></pre>');
  });

  test('formatting without a sandshark counterpart keeps its text', () => {
    expect(
      markdownToHtml('__under__ ~~gone~~ ||secret||', noMarkdownLookups)
    ).toBe('<p>under gone secret</p>');
  });

  test('links, masked and bare, become anchors without eating punctuation', () => {
    expect(
      markdownToHtml(
        'see [docs](https://example.com/a_b) or https://example.com.',
        noMarkdownLookups
      )
    ).toBe(
      '<p>see <a href="https://example.com/a_b">docs</a> or <a href="https://example.com">https://example.com</a>.</p>'
    );
  });

  test('resolved mentions become the spans the client renders, unresolved stay text', () => {
    const html = markdownToHtml(
      'hi <@11> <@!11> <@&22> <#33> <:wave:44> <@99>',
      {
        users: new Map([['11', { id: 2, name: 'Test User' }]]),
        roles: new Map([['22', { id: 3, name: 'Guest' }]]),
        channels: new Map([['33', { id: 1 }]]),
        emojis: new Map([['44', { name: 'wave' }]])
      }
    );

    expect(html).toBe(
      '<p>hi <span data-type="mention" data-user-id="2" class="mention">@Test User</span> <span data-type="mention" data-user-id="2" class="mention">@Test User</span> <span data-type="role-mention" data-role-id="3" class="role-mention">@Guest</span> <span data-type="channel-reference" data-channel-id="1" class="channel-reference"></span> <span data-type="emoji" data-name="wave"></span> &lt;@99&gt;</p>'
    );
    // what the send route stores after sanitizing is the same markup
    expect(sanitizeMessageHtml(html)).toBe(html);
  });

  test('collects the snowflakes to resolve', () => {
    expect(
      collectMarkdownMentions('<@1> <@!2> <@&3> <#4> <a:dance:5> `<@6>`')
    ).toEqual({
      userIds: ['1', '2', '6'],
      roleIds: ['3'],
      channelIds: ['4'],
      emojiIds: ['5']
    });
  });
});

describe('html to markdown', () => {
  test('paragraphs, breaks and formatting', () => {
    expect(
      htmlToMarkdown(
        '<p><strong>bold</strong> <em>it</em> <code>x</code></p><p>a<br>b</p>',
        noHtmlLookups
      )
    ).toBe('**bold** *it* `x`\na\nb');
  });

  test('decodes entities and keeps commands readable', () => {
    expect(htmlToMarkdown('<p>!ping &amp; &lt;3</p>', noHtmlLookups)).toBe(
      '!ping & <3'
    );
  });

  test('code blocks and links', () => {
    expect(
      htmlToMarkdown(
        '<pre><code>a &lt; b</code></pre><p><a href="https://x.dev">site</a> <a href="https://y.dev">https://y.dev</a></p>',
        noHtmlLookups
      )
    ).toBe('```\na < b\n```\n[site](https://x.dev) https://y.dev');
  });

  test('mentions, channels and custom emoji become snowflake tokens', () => {
    const html =
      '<p><span data-type="mention" data-user-id="2" class="mention">@Test User</span> <span data-type="role-mention" data-role-id="3" class="role-mention">@Guest</span> <span data-type="channel-reference" data-channel-id="1" class="channel-reference"></span> <span data-type="emoji" data-name="wave"><img src="/public/wave.png" class="emoji-image"></span> <span data-type="emoji" data-name="smile">😄</span></p>';

    expect(collectHtmlMentions(html)).toEqual({
      userIds: [2],
      roleIds: [3],
      channelIds: [1],
      emojiNames: ['wave', 'smile']
    });
    expect(
      htmlToMarkdown(html, {
        userSnowflakes: new Map([[2, '11']]),
        roleSnowflakes: new Map([[3, '22']]),
        channelSnowflakes: new Map([[1, '33']]),
        customEmojis: new Map([['wave', '44']])
      })
    ).toBe('<@11> <@&22> <#33> <:wave:44> 😄');
  });

  test('a mention of someone unknown keeps its label', () => {
    expect(
      htmlToMarkdown(
        '<p><span data-type="mention" data-user-id="9" class="mention">@Gone</span></p>',
        noHtmlLookups
      )
    ).toBe('@Gone');
  });

  test('round trips what a bot sends', () => {
    const lookups = {
      users: new Map([['11', { id: 2, name: 'Test User' }]]),
      roles: new Map(),
      channels: new Map(),
      emojis: new Map()
    };
    const markdown = '**hey** <@11>\n`!ping` https://example.com';

    expect(
      htmlToMarkdown(markdownToHtml(markdown, lookups), {
        ...noHtmlLookups,
        userSnowflakes: new Map([[2, '11']])
      })
    ).toBe(markdown);
  });
});
