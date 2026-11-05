import type { TJoinedMessage } from '@sandshark/shared';

// static values for ChatInputDivider component
const MAX_VH = 80;
const MIN_PX = 56;
const RESET_THRESHOLD_PX = 10;
const DEFAULT_MAX_HEIGHT_VH = 35;

type TMessagesGroupComparatorProps = {
  group: TJoinedMessage[];
  disableActions?: boolean;
  disableFiles?: boolean;
  disableReactions?: boolean;
  onReplyMessageSelect?: (message: TJoinedMessage) => void;
  replyTargetMessageId?: number;
  activeThreadMessageId?: number;
  editingMessageId?: number;
  onEditComplete?: () => void;
};

const groupContainsMessageId = (
  group: TJoinedMessage[],
  messageId: number | undefined
) => {
  if (messageId === undefined) {
    return false;
  }

  return group.some((message) => message.id === messageId);
};

const areGroupsEqual = (
  prevProps: TMessagesGroupComparatorProps,
  nextProps: TMessagesGroupComparatorProps
) => {
  if (
    prevProps.disableActions !== nextProps.disableActions ||
    prevProps.disableFiles !== nextProps.disableFiles ||
    prevProps.disableReactions !== nextProps.disableReactions ||
    prevProps.onReplyMessageSelect !== nextProps.onReplyMessageSelect
  ) {
    return false;
  }

  if (prevProps.group.length !== nextProps.group.length) {
    return false;
  }

  for (let index = 0; index < prevProps.group.length; index += 1) {
    if (prevProps.group[index] !== nextProps.group[index]) {
      return false;
    }
  }

  const replyTargetUnchanged =
    prevProps.replyTargetMessageId === nextProps.replyTargetMessageId;
  const activeThreadUnchanged =
    prevProps.activeThreadMessageId === nextProps.activeThreadMessageId;
  const editingUnchanged =
    prevProps.editingMessageId === nextProps.editingMessageId;

  if (replyTargetUnchanged && activeThreadUnchanged && editingUnchanged) {
    return true;
  }

  const isReplyTargetChangeRelevant = !replyTargetUnchanged
    ? groupContainsMessageId(prevProps.group, prevProps.replyTargetMessageId) ||
      groupContainsMessageId(nextProps.group, nextProps.replyTargetMessageId)
    : false;
  const isActiveThreadChangeRelevant = !activeThreadUnchanged
    ? groupContainsMessageId(
        prevProps.group,
        prevProps.activeThreadMessageId
      ) ||
      groupContainsMessageId(nextProps.group, nextProps.activeThreadMessageId)
    : false;
  const isEditingChangeRelevant = !editingUnchanged
    ? groupContainsMessageId(prevProps.group, prevProps.editingMessageId) ||
      groupContainsMessageId(nextProps.group, nextProps.editingMessageId)
    : false;

  return (
    !isReplyTargetChangeRelevant &&
    !isActiveThreadChangeRelevant &&
    !isEditingChangeRelevant
  );
};

// calculate the minimum acceptable chat input height
const measureMinHeight = (composeEl: HTMLDivElement): number => {
  const proseMirror = composeEl.querySelector('.ProseMirror');

  if (!proseMirror) return MIN_PX;

  // clamp to one line to measure empty state
  const savedHeight = composeEl.style.height;
  const savedMaxHeight = composeEl.style.maxHeight;
  const scrollRow = composeEl.querySelector('.compose-scroll-row');

  const savedScrollTop = scrollRow?.scrollTop ?? 0;

  proseMirror.classList.add('line-clamp-1');

  composeEl.style.height = '';
  composeEl.style.maxHeight = '';

  const minHeight = getHeight(composeEl);

  // restore height and scroll position
  composeEl.style.height = savedHeight;
  composeEl.style.maxHeight = savedMaxHeight;

  proseMirror.classList.remove('line-clamp-1');

  if (scrollRow) scrollRow.scrollTop = savedScrollTop;

  return Math.max(MIN_PX, minHeight);
};

const getHeight = (el: HTMLElement) => el.getBoundingClientRect().height;

const X_EMBED_ORIGIN = 'https://platform.twitter.com';

// an x post is taller than this only by mistake or by a hostile frame, and the iframe is sized
// from the message, so the value is bounded
const MAX_X_EMBED_HEIGHT_PX = 2000;

// the height an x embed reports for the post it rendered. its frame posts
// { 'twttr.embed': { method: 'twttr.private.resize', params: [{ width, height }] } } to the
// page around it whenever the post lays out, the way x's own widgets.js sizes embeds. undefined
// for any other message
const getXEmbedHeight = (data: unknown): number | undefined => {
  if (!data || typeof data !== 'object') return undefined;

  const embed = (data as Record<string, unknown>)['twttr.embed'];

  if (!embed || typeof embed !== 'object') return undefined;

  const { method, params } = embed as { method?: unknown; params?: unknown };

  if (method !== 'twttr.private.resize' || !Array.isArray(params)) {
    return undefined;
  }

  const [size] = params as { height?: unknown }[];
  const height = size?.height;

  if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) {
    return undefined;
  }

  return Math.min(Math.ceil(height), MAX_X_EMBED_HEIGHT_PX);
};

export {
  areGroupsEqual,
  DEFAULT_MAX_HEIGHT_VH,
  getHeight,
  getXEmbedHeight,
  groupContainsMessageId,
  MAX_VH,
  measureMinHeight,
  MIN_PX,
  RESET_THRESHOLD_PX,
  X_EMBED_ORIGIN
};
