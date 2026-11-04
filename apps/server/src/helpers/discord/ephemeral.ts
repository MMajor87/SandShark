import type { TJoinedMessage } from '@sandshark/shared';
import type { TBotEphemeralRow, TBotInteraction } from '../bot-interactions';
import {
  DiscordMessageFlag,
  serializeMessages,
  type TMessageSerializeOptions
} from './message';
import { encodeSnowflake, SnowflakeTag } from './snowflake';

const ephemeralSnowflake = (row: Pick<TBotEphemeralRow, 'id' | 'createdAt'>) =>
  encodeSnowflake(SnowflakeTag.EPHEMERAL_MESSAGE, row.id, row.createdAt);

// an ephemeral answer has no message row, so it is shaped like one for the serializer.
// `owner` is the interaction that posted it, which a later button press on it is not
const ephemeralAsMessage = (
  row: TBotEphemeralRow,
  owner: TBotInteraction
): TJoinedMessage => ({
  id: row.id,
  content: row.content,
  userId: owner.botId,
  pluginId: null,
  pluginComponents: null,
  channelId: owner.channelId,
  parentMessageId: null,
  replyToMessageId: null,
  editable: true,
  metadata: null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  pinned: false,
  pinnedAt: null,
  pinnedBy: null,
  editedAt: null,
  editedBy: null,
  interactionId: owner.id,
  interactionUserId: row.original ? owner.userId : null,
  interactionCommandName: row.original ? owner.commandName : null,
  loading: row.loading,
  embeds: row.embeds,
  components: row.components,
  files: [],
  reactions: []
});

// as discord sends it: its own id and the ephemeral flag
const serializeEphemeralMessage = async (
  row: TBotEphemeralRow,
  owner: TBotInteraction,
  options: TMessageSerializeOptions
) => {
  const [serialized] = await serializeMessages(
    [ephemeralAsMessage(row, owner)],
    options
  );

  return {
    ...serialized!,
    id: ephemeralSnowflake(row),
    flags: serialized!.flags | DiscordMessageFlag.EPHEMERAL
  };
};

export { ephemeralSnowflake, serializeEphemeralMessage };
