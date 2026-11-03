import { MessageNodeType } from '@sandshark/shared';

// discord bots speak markdown and sandshark stores sanitized html, so content is converted
// both ways at the edge of the bot api. only what the sanitizer allows has a counterpart:
// bold, italic, code, links, mentions, channel references and emoji. underline,
// strikethrough, spoilers and quotes keep their text and lose the formatting

type TMarkdownMentionLookups = {
  users: Map<string, { id: number; name: string }>;
  roles: Map<string, { id: number; name: string }>;
  channels: Map<string, { id: number }>;
  emojis: Map<string, { name: string }>;
};

type THtmlMentionLookups = {
  userSnowflakes: Map<number, string>;
  roleSnowflakes: Map<number, string>;
  channelSnowflakes: Map<number, string>;
  customEmojis: Map<string, string>;
};

// a private use character marks where converted html is held back from escaping, it never
// appears in real text
const PLACEHOLDER = String.fromCharCode(0xe000);
const PLACEHOLDER_PATTERN = new RegExp(
  `${PLACEHOLDER}([0-9]+)${PLACEHOLDER}`,
  'g'
);
const PLACEHOLDER_LINE = new RegExp(`^${PLACEHOLDER}[0-9]+${PLACEHOLDER}$`);

const USER_MENTION = /<@!?(\d{1,20})>/g;
const ROLE_MENTION = /<@&(\d{1,20})>/g;
const CHANNEL_MENTION = /<#(\d{1,20})>/g;
const CUSTOM_EMOJI = /<a?:(\w{2,32}):(\d{1,20})>/g;

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');

// the snowflakes a markdown message refers to, so they can be resolved in one batch first
const collectMarkdownMentions = (markdown: string) => ({
  userIds: [...markdown.matchAll(USER_MENTION)].map((match) => match[1]!),
  roleIds: [...markdown.matchAll(ROLE_MENTION)].map((match) => match[1]!),
  channelIds: [...markdown.matchAll(CHANNEL_MENTION)].map((match) => match[1]!),
  emojiIds: [...markdown.matchAll(CUSTOM_EMOJI)].map((match) => match[2]!)
});

const applyInlineFormatting = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\|\|(.+?)\|\|/g, '$1')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|\W)_(?!\s)(.+?)_(?=\W|$)/g, '$1<em>$2</em>');

const markdownToHtml = (markdown: string, lookups: TMarkdownMentionLookups) => {
  const placeholders: string[] = [];
  const hold = (html: string) => {
    placeholders.push(html);

    return `${PLACEHOLDER}${placeholders.length - 1}${PLACEHOLDER}`;
  };

  let text = markdown.replace(/\r\n/g, '\n');

  text = text.replace(/```(?:[\w+-]*\n)?([\s\S]*?)```/g, (_, code: string) =>
    hold(`<pre><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`)
  );
  text = text.replace(/`([^`\n]+)`/g, (_, code: string) =>
    hold(`<code>${escapeHtml(code)}</code>`)
  );
  text = text.replace(USER_MENTION, (match, id: string) => {
    const user = lookups.users.get(id);

    if (!user) return match;

    return hold(
      `<span data-type="${MessageNodeType.MENTION}" data-user-id="${user.id}" class="mention">@${escapeHtml(user.name)}</span>`
    );
  });
  text = text.replace(ROLE_MENTION, (match, id: string) => {
    const role = lookups.roles.get(id);

    if (!role) return match;

    return hold(
      `<span data-type="${MessageNodeType.ROLE_MENTION}" data-role-id="${role.id}" class="role-mention">@${escapeHtml(role.name)}</span>`
    );
  });
  text = text.replace(CHANNEL_MENTION, (match, id: string) => {
    const channel = lookups.channels.get(id);

    if (!channel) return match;

    return hold(
      `<span data-type="${MessageNodeType.CHANNEL_REFERENCE}" data-channel-id="${channel.id}" class="channel-reference"></span>`
    );
  });
  text = text.replace(CUSTOM_EMOJI, (match, _name: string, id: string) => {
    const emoji = lookups.emojis.get(id);

    if (!emoji) return match;

    return hold(
      `<span data-type="${MessageNodeType.EMOJI}" data-name="${escapeHtml(emoji.name)}"></span>`
    );
  });
  text = text.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label: string, href: string) =>
      hold(`<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`)
  );
  text = text.replace(/https?:\/\/[^\s<]+[^\s<.,:;"')\]]/g, (href) =>
    hold(`<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`)
  );

  const restore = (value: string): string =>
    value.replace(PLACEHOLDER_PATTERN, (_, index: string) =>
      restore(placeholders[Number(index)]!)
    );

  const html = text
    .split('\n')
    .map((line) => {
      // a code block on its own line is a block itself, not text inside a paragraph
      if (PLACEHOLDER_LINE.test(line) && restore(line).startsWith('<pre>')) {
        return restore(line);
      }

      const formatted = applyInlineFormatting(escapeHtml(line));

      return `<p>${restore(formatted)}</p>`;
    })
    .join('');

  return html;
};

type TOpenSpan = {
  // the inner text is replaced by the token already written, so it is dropped
  skip: boolean;
};

const TOKEN = /<(\/?)([a-z0-9]+)((?:\s+[^>]*)?)\/?>|([^<]+)/gi;

const getAttribute = (attributes: string, name: string) => {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(attributes);

  return match ? decodeEntities(match[1]!) : undefined;
};

// the snowflakes stored html refers to, so they can be resolved in one batch first
const collectHtmlMentions = (html: string) => {
  const userIds = new Set<number>();
  const roleIds = new Set<number>();
  const channelIds = new Set<number>();
  const emojiNames = new Set<string>();

  for (const match of html.matchAll(/<span\b([^>]*)>/g)) {
    const attributes = match[1]!;
    const type = getAttribute(attributes, 'data-type');
    const userId = getAttribute(attributes, 'data-user-id');
    const roleId = getAttribute(attributes, 'data-role-id');
    const channelId = getAttribute(attributes, 'data-channel-id');
    const name = getAttribute(attributes, 'data-name');

    if (type === MessageNodeType.MENTION && userId) userIds.add(Number(userId));
    if (type === MessageNodeType.ROLE_MENTION && roleId) {
      roleIds.add(Number(roleId));
    }
    if (type === MessageNodeType.CHANNEL_REFERENCE && channelId) {
      channelIds.add(Number(channelId));
    }
    if (type === MessageNodeType.EMOJI && name) emojiNames.add(name);
  }

  return {
    userIds: [...userIds],
    roleIds: [...roleIds],
    channelIds: [...channelIds],
    emojiNames: [...emojiNames]
  };
};

const spanToken = (attributes: string, lookups: THtmlMentionLookups) => {
  const type = getAttribute(attributes, 'data-type');

  if (type === MessageNodeType.MENTION) {
    const snowflake = lookups.userSnowflakes.get(
      Number(getAttribute(attributes, 'data-user-id'))
    );

    return snowflake ? `<@${snowflake}>` : undefined;
  }

  if (type === MessageNodeType.ROLE_MENTION) {
    const snowflake = lookups.roleSnowflakes.get(
      Number(getAttribute(attributes, 'data-role-id'))
    );

    return snowflake ? `<@&${snowflake}>` : undefined;
  }

  if (type === MessageNodeType.CHANNEL_REFERENCE) {
    const snowflake = lookups.channelSnowflakes.get(
      Number(getAttribute(attributes, 'data-channel-id'))
    );

    return snowflake ? `<#${snowflake}>` : '#unknown';
  }

  if (type === MessageNodeType.EMOJI) {
    const name = getAttribute(attributes, 'data-name') ?? '';
    const snowflake = lookups.customEmojis.get(name);

    return snowflake ? `<:${name}:${snowflake}>` : undefined;
  }

  return undefined;
};

const htmlToMarkdown = (html: string, lookups: THtmlMentionLookups) => {
  let output = '';
  let blocks = 0;
  let inPre = false;
  let link: { href: string; text: string } | undefined;
  const spans: TOpenSpan[] = [];

  const skipping = () => spans.some((span) => span.skip);

  const write = (value: string) => {
    if (skipping()) return;

    if (link) {
      link.text += value;
      return;
    }

    output += value;
  };

  for (const match of html.matchAll(TOKEN)) {
    const [, closing, rawTag, attributes = '', text] = match;

    if (text !== undefined) {
      write(decodeEntities(text));
      continue;
    }

    const tag = rawTag!.toLowerCase();
    const isClosing = closing === '/';

    switch (tag) {
      case 'p':
        if (!isClosing && blocks++ > 0) write('\n');
        break;
      case 'br':
        write('\n');
        break;
      case 'strong':
        write('**');
        break;
      case 'em':
        write('*');
        break;
      case 'code':
        if (!inPre) write('`');
        break;
      case 'pre':
        if (isClosing) {
          write('\n```');
          inPre = false;
        } else {
          if (blocks++ > 0) write('\n');
          write('```\n');
          inPre = true;
        }
        break;
      case 'a':
        if (isClosing && link) {
          const { href, text: label } = link;

          link = undefined;
          write(label === href || !label ? href : `[${label}](${href})`);
        } else if (!isClosing && !skipping()) {
          link = { href: getAttribute(attributes, 'href') ?? '', text: '' };
        }
        break;
      case 'span':
        if (isClosing) {
          spans.pop();
        } else {
          const token = spanToken(attributes, lookups);

          if (token !== undefined) write(token);

          spans.push({ skip: token !== undefined });
        }
        break;
      case 'img': {
        const alt = getAttribute(attributes, 'alt');

        if (alt) write(alt.startsWith(':') ? alt : `:${alt}:`);
        break;
      }
      default:
        break;
    }
  }

  return output.trim();
};

export {
  collectHtmlMentions,
  collectMarkdownMentions,
  htmlToMarkdown,
  markdownToHtml,
  type THtmlMentionLookups,
  type TMarkdownMentionLookups
};
