import { createContext } from 'react';

// a row in the sidebar: the direct messages, threads and calendar toggles, and every channel
export const SIDEBAR_ITEM_CLASS =
  'flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring';

// the open row, tinted with the user's accent and marked with a bar on its left edge, so it
// stands apart from a row that is only hovered
export const SIDEBAR_ITEM_ACTIVE_CLASS =
  'bg-highlight-soft font-medium text-foreground shadow-[inset_3px_0_0_0_var(--highlight)] hover:bg-highlight-soft hover:text-foreground [&>svg]:text-highlight';

export const VOICE_USER_DND_MIME = 'application/x-sandshark-user-id';

export const categoryDndId = (categoryId: number) => `category:${categoryId}`;

export const channelDndId = (channelId: number) => `channel:${channelId}`;

export const categoryDropDndId = (categoryId: number) =>
  `category-drop:${categoryId}`;

export type TSidebarDragData =
  | { type: 'category'; categoryId: number }
  | { type: 'channel'; channelId: number; categoryId: number }
  | { type: 'category-drop'; categoryId: number };

export type TChannelDragPreview = {
  channelId: number;
  categoryId: number;
  index: number;
};

export const ChannelDragPreviewContext =
  createContext<TChannelDragPreview | null>(null);

export const applyChannelDragPreview = (
  channelIds: number[],
  categoryId: number,
  preview: TChannelDragPreview | null
) => {
  if (!preview) {
    return channelIds;
  }

  const withoutDraggedChannel = channelIds.filter(
    (channelId) => channelId !== preview.channelId
  );

  if (preview.categoryId !== categoryId) {
    return withoutDraggedChannel;
  }

  withoutDraggedChannel.splice(preview.index, 0, preview.channelId);

  return withoutDraggedChannel;
};

// below these the round trip to the voice server feels instant, then noticeable, then laggy
export const GOOD_PING_MS = 100;
export const FAIR_PING_MS = 250;

export type TPingQuality = 'good' | 'fair' | 'poor';

// the round trip to the voice server, from whichever transport has measured one. the sending
// and receiving transports reach the same server, so either answer is the same latency.
// undefined until one has, since webrtc reports 0 before the first measurement
export const getVoicePing = (
  ...rtts: (number | null | undefined)[]
): number | undefined => {
  const rtt = rtts.find(
    (value) => value !== null && value !== undefined && value > 0
  );

  return rtt === null || rtt === undefined ? undefined : Math.round(rtt);
};

export const getPingQuality = (ping: number): TPingQuality => {
  if (ping < GOOD_PING_MS) return 'good';
  if (ping < FAIR_PING_MS) return 'fair';

  return 'poor';
};
