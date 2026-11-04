import type { TBotActionRow, TMessageEmbed } from '@sandshark/shared';
import { z } from 'zod';
import {
  areComponentsValid,
  toStoredComponents,
  zDiscordComponents
} from '../../helpers/discord/component';
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
// answer or a follow up. attachments come later
const zMessageBody = z.object({
  content: z.string().max(2_000).optional(),
  embeds: zDiscordEmbeds.optional(),
  components: zDiscordComponents.optional(),
  flags: z.number().int().min(0).optional()
});

type TMessageBody = z.infer<typeof zMessageBody>;

// undefined means the body did not mention it, so an edit leaves it as it is
type TStoredBody = {
  html: string | undefined;
  embeds: TMessageEmbed[] | undefined;
  components: TBotActionRow[] | undefined;
};

const emptyMessage = () =>
  new DiscordApiError(
    400,
    DiscordErrorCode.CANNOT_SEND_EMPTY_MESSAGE,
    'Cannot send an empty message'
  );

// components alone do not make a message, as on discord
const hasStoredContent = ({
  html,
  embeds
}: Pick<TStoredBody, 'html' | 'embeds'>) => !!html || !!embeds?.length;

// a new message needs text or an embed. an edit may change either one alone
const toStoredBody = async (
  body: TMessageBody,
  { requireContent }: { requireContent: boolean }
): Promise<TStoredBody> => {
  if (body.embeds && !areEmbedsValid(body.embeds)) throw invalidFormBody();

  if (body.components && !areComponentsValid(body.components)) {
    throw invalidFormBody();
  }

  const guild = await getGuildContext();
  let html: string | undefined = undefined;

  if (body.content !== undefined) {
    html = body.content.trim() ? await toStoredHtml(body.content, guild) : '';
  }

  const stored = {
    html,
    embeds: body.embeds ? await toStoredEmbeds(body.embeds, guild) : undefined,
    components: body.components
      ? toStoredComponents(body.components)
      : undefined
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
