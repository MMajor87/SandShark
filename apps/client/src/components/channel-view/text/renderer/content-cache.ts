import { isEmojiOnlyMessage, type TJoinedMessage } from '@sandshark/shared';
import parse, {
  attributesToProps,
  domToReact,
  Element,
  type DOMNode
} from 'html-react-parser';
import { createElement, type ReactNode } from 'react';
import { extractYoutubeVideoIds } from './helpers';
import { readFromCache, writeToCache } from './lru-cache';
import { serializer } from './serializer';

const parsedMessageCache = new Map<string, ReactNode>();
const emojiOnlyCache = new Map<string, boolean>();
const youtubeVideoIdsCache = new Map<string, string[]>();

const hashContent = (content: string) => {
  let hash = 0;

  for (let i = 0; i < content.length; i++) {
    hash = (Math.imul(31, hash) + content.charCodeAt(i)) | 0;
  }

  return hash.toString(36);
};

// the content has to take part in the key because a plugin command rewrites a
// message's content without touching editedAt
const getMessageContentCacheKey = (message: TJoinedMessage) =>
  `${message.id}:${message.editedAt ?? 0}:${hashContent(message.content ?? '')}`;

// message html as react, with the overrides messages render through. the message id lets
// those overrides act on the message they belong to
const parseMessageHtml = (html: string, messageId: number) => {
  const replace = (domNode: DOMNode) => {
    if (domNode instanceof Element && domNode.name === 'p') {
      return createElement(
        'p',
        { dir: 'auto' },
        domToReact(domNode.children as DOMNode[], { replace })
      );
    }

    if (domNode instanceof Element && domNode.name === 'a') {
      return createElement(
        'a',
        { ...attributesToProps(domNode.attribs), dir: 'auto' },
        domToReact(domNode.children as DOMNode[], { replace })
      );
    }

    return serializer(domNode, messageId);
  };

  return parse(html, { replace });
};

const getParsedMessageHtml = (message: TJoinedMessage) => {
  const cacheKey = getMessageContentCacheKey(message);
  const cached = readFromCache(parsedMessageCache, cacheKey);

  if (cached !== undefined) return cached;

  const parsed = parseMessageHtml(message.content ?? '', message.id);

  writeToCache(parsedMessageCache, cacheKey, parsed);

  return parsed;
};

const getIsEmojiOnly = (message: TJoinedMessage) => {
  const cacheKey = getMessageContentCacheKey(message);
  const cached = readFromCache(emojiOnlyCache, cacheKey);

  if (cached !== undefined) return cached;

  const emojiOnly = isEmojiOnlyMessage(message.content);

  writeToCache(emojiOnlyCache, cacheKey, emojiOnly);

  return emojiOnly;
};

// embeds render below the message instead of replacing the link to avoid having invalid html
const getYoutubeVideoIds = (message: TJoinedMessage) => {
  const cacheKey = getMessageContentCacheKey(message);
  const cached = readFromCache(youtubeVideoIdsCache, cacheKey);

  if (cached !== undefined) return cached;

  const youtubeVideoIds = extractYoutubeVideoIds(message.content ?? '');

  writeToCache(youtubeVideoIdsCache, cacheKey, youtubeVideoIds);

  return youtubeVideoIds;
};

export {
  getIsEmojiOnly,
  getParsedMessageHtml,
  getYoutubeVideoIds,
  parseMessageHtml
};
