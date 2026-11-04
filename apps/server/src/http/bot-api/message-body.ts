import type { TMessageEmbed } from '@sandshark/shared';
import { z } from 'zod';
import { toStoredHtml } from '../../helpers/discord/content';
import {
  areEmbedsValid,
  toStoredEmbeds,
  zDiscordEmbeds
} from '../../helpers/discord/embed';
import { getGuildContext } from '../../helpers/discord/guild';
import { DiscordApiError, DiscordErrorCode } from './errors';
import { invalidFormBody } from './helpers';

// what a bot sends as a message, wherever it sends one: a channel message, an interaction
// answer or a follow up. components and attachments come later (#58)
const zMessageBody = z.object({
  content: z.string().max(2_000).optional(),
  embeds: zDiscordEmbeds.optional(),
  flags: z.number().int().min(0).optional()
});

type TMessageBody = z.infer<typeof zMessageBody>;

// undefined means the body did not mention it, so an edit leaves it as it is
type TStoredBody = {
  html: string | undefined;
  embeds: TMessageEmbed[] | undefined;
};

const emptyMessage = () =>
  new DiscordApiError(
    400,
    DiscordErrorCode.CANNOT_SEND_EMPTY_MESSAGE,
    'Cannot send an empty message'
  );

const hasStoredContent = ({ html, embeds }: TStoredBody) =>
  !!html || !!embeds?.length;

// a new message needs text or an embed. an edit may change either one alone
const toStoredBody = async (
  body: TMessageBody,
  { requireContent }: { requireContent: boolean }
): Promise<TStoredBody> => {
  if (body.embeds && !areEmbedsValid(body.embeds)) throw invalidFormBody();

  const guild = await getGuildContext();
  let html: string | undefined = undefined;

  if (body.content !== undefined) {
    html = body.content.trim() ? await toStoredHtml(body.content, guild) : '';
  }

  const stored = {
    html,
    embeds: body.embeds ? await toStoredEmbeds(body.embeds, guild) : undefined
  };

  if (requireContent && !hasStoredContent(stored)) throw emptyMessage();

  return stored;
};

export {
  emptyMessage,
  hasStoredContent,
  toStoredBody,
  zMessageBody,
  type TMessageBody,
  type TStoredBody
};
