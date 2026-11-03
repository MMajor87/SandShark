export enum ServerEvents {
  NEW_MESSAGE = 'newMessage',
  MESSAGE_UPDATE = 'messageUpdate',
  MESSAGE_DELETE = 'messageDelete',
  MESSAGE_TYPING = 'messageTyping',
  // server side only, the bot gateway turns it into discord reaction events
  MESSAGE_REACTION_CHANGE = 'messageReactionChange',
  THREAD_REPLY_COUNT_UPDATE = 'threadReplyCountUpdate',
  THREAD_FOLLOW_UPDATE = 'threadFollowUpdate',

  USER_JOIN = 'userJoin',
  USER_LEAVE = 'userLeave',

  CHANNEL_CREATE = 'channelCreate',
  CHANNEL_UPDATE = 'channelUpdate',
  CHANNEL_DELETE = 'channelDelete',
  CHANNEL_PERMISSIONS_UPDATE = 'channelPermissionsUpdate',
  CHANNEL_READ_STATES_UPDATE = 'channelReadStatesUpdate',
  CHANNEL_READ_STATES_DELTA = 'channelReadStatesDelta',

  USER_JOIN_VOICE = 'userJoinVoice',
  USER_LEAVE_VOICE = 'userLeaveVoice',
  USER_VOICE_STATE_UPDATE = 'userVoiceStateUpdate',
  USER_VOICE_MOVED = 'userVoiceMoved',
  USER_VOICE_REACTION = 'userVoiceReaction',

  VOICE_ADD_EXTERNAL_STREAM = 'voiceAddExternalStream',
  VOICE_UPDATE_EXTERNAL_STREAM = 'voiceUpdateExternalStream',
  VOICE_REMOVE_EXTERNAL_STREAM = 'voiceRemoveExternalStream',
  VOICE_NEW_PRODUCER = 'voiceNewProducer',
  VOICE_PRODUCER_CLOSED = 'voiceProducerClosed',

  EMOJI_CREATE = 'emojiCreate',
  EMOJI_UPDATE = 'emojiUpdate',
  EMOJI_DELETE = 'emojiDelete',
  SOUNDBOARD_SOUND_CREATE = 'soundboardSoundCreate',
  SOUNDBOARD_SOUND_UPDATE = 'soundboardSoundUpdate',
  SOUNDBOARD_SOUND_DELETE = 'soundboardSoundDelete',
  SOUNDBOARD_SOUND_PLAY = 'soundboardSoundPlay',

  ROLE_CREATE = 'roleCreate',
  ROLE_UPDATE = 'roleUpdate',
  ROLE_DELETE = 'roleDelete',

  USER_CREATE = 'userCreate',
  USER_UPDATE = 'userUpdate',
  USER_DELETE = 'userDelete',

  SERVER_SETTINGS_UPDATE = 'serverSettingsUpdate',

  PLUGIN_LOG = 'pluginLog',
  PLUGIN_COMMANDS_CHANGE = 'pluginCommandsChange',
  PLUGIN_COMPONENTS_CHANGE = 'pluginComponentsChange',
  PLUGIN_CAPABILITY_ACCESS_CHANGE = 'pluginCapabilityAccessChange',
  PLUGIN_METADATA_CHANGE = 'pluginMetadataChange',
  PLUGIN_PUSH = 'pluginPush',
  PLUGIN_EPHEMERAL_RESPONSE = 'pluginEphemeralResponse',

  // server side only, the bot gateway turns it into INTERACTION_CREATE
  BOT_INTERACTION_CREATE = 'botInteractionCreate',
  BOT_INTERACTION_FAILED = 'botInteractionFailed',
  BOT_EPHEMERAL_MESSAGE = 'botEphemeralMessage',
  BOT_EPHEMERAL_MESSAGE_DELETE = 'botEphemeralMessageDelete',

  CATEGORY_CREATE = 'categoryCreate',
  CATEGORY_UPDATE = 'categoryUpdate',
  CATEGORY_DELETE = 'categoryDelete',

  DM_CONVERSATION_UPDATE = 'dmConversationUpdate'
}

export type TNewMessage = {
  content: string;
  channelId: number;
};
