import { getGuildContext } from '../../../helpers/discord/guild';
import { callProcedure } from '../call-procedure';
import { createBotCaller } from '../context';
import { DiscordErrorCode } from '../errors';
import {
  invalidFormBody,
  loadMessageId,
  loadVisibleChannel,
  readJsonBody,
  serializeForBot
} from '../helpers';
import { toStoredBody, zMessageBody } from '../message-body';
import type { TBotRouteHandler } from '../types';

const editMessageRoute: TBotRouteHandler = async (request) => {
  const { bot, info, params, req } = request;
  const parsed = zMessageBody.safeParse(await readJsonBody(req));

  if (!parsed.success) throw invalidFormBody();

  const { html, embeds } = await toStoredBody(parsed.data, {
    requireContent: false
  });

  const channel = await loadVisibleChannel(bot.id, params.channelId!);
  const messageId = await loadMessageId(channel.id, params.messageId!);
  const guild = await getGuildContext();
  const caller = createBotCaller(bot, info, { embeds });
  const unknownMessage = {
    code: DiscordErrorCode.UNKNOWN_MESSAGE,
    what: 'Message'
  };
  const current = await callProcedure(
    () => caller.messages.getOne({ messageId }),
    unknownMessage
  );

  // an edit changes what it names and keeps the rest, as on discord
  if (html !== undefined || embeds !== undefined) {
    await callProcedure(
      () =>
        caller.messages.edit({
          messageId,
          content: html ?? current.content ?? ''
        }),
      unknownMessage
    );
  }

  const message = await callProcedure(
    () => caller.messages.getOne({ messageId }),
    unknownMessage
  );
  const [serialized] = await serializeForBot(request, guild, [message]);

  return serialized;
};

export { editMessageRoute };
