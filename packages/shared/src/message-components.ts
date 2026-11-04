// discord's message component types that sandshark has. the newer layout components
// are not here yet
export enum BotComponentType {
  ACTION_ROW = 1,
  BUTTON = 2,
  STRING_SELECT = 3,
  TEXT_INPUT = 4,
  USER_SELECT = 5,
  ROLE_SELECT = 6,
  MENTIONABLE_SELECT = 7,
  CHANNEL_SELECT = 8,
  // wraps one input of a modal with its label
  LABEL = 18
}

export enum BotTextInputStyle {
  SHORT = 1,
  PARAGRAPH = 2
}

export enum BotButtonStyle {
  PRIMARY = 1,
  SECONDARY = 2,
  SUCCESS = 3,
  DANGER = 4,
  LINK = 5
}

// a unicode emoji by its character, or a custom one by name
export type TBotComponentEmoji = {
  name: string;
};

export type TBotButton = {
  type: BotComponentType.BUTTON;
  style: BotButtonStyle;
  label?: string;
  emoji?: TBotComponentEmoji;
  // a link button has a url and no custom id, every other button the other way round
  customId?: string;
  url?: string;
  disabled: boolean;
};

export type TBotSelectOption = {
  label: string;
  value: string;
  description?: string;
  emoji?: TBotComponentEmoji;
  default: boolean;
};

export type TBotStringSelect = {
  type: BotComponentType.STRING_SELECT;
  customId: string;
  placeholder?: string;
  minValues: number;
  maxValues: number;
  disabled: boolean;
  options: TBotSelectOption[];
};

// a select menu the server fills with its own members, roles or channels. what is chosen
// is sent as "user:5", "role:2" or "channel:7", the kind first since a mentionable allows two
export type TBotEntitySelect = {
  type:
    | BotComponentType.USER_SELECT
    | BotComponentType.ROLE_SELECT
    | BotComponentType.MENTIONABLE_SELECT
    | BotComponentType.CHANNEL_SELECT;
  customId: string;
  placeholder?: string;
  minValues: number;
  maxValues: number;
  disabled: boolean;
  channelTypes?: number[];
};

export type TBotActionRow = {
  type: BotComponentType.ACTION_ROW;
  components: (TBotButton | TBotStringSelect | TBotEntitySelect)[];
};

// one field of a bot's modal
export type TBotTextInput = {
  customId: string;
  label: string;
  description?: string;
  style: BotTextInputStyle;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  value?: string;
};

// a form a bot opens for the member who used its command or component. `labelled` says
// whether the bot wrapped its inputs in labels or in action rows, so the answer comes back
// in the same shape
export type TBotModal = {
  customId: string;
  title: string;
  labelled: boolean;
  inputs: TBotTextInput[];
};

// a bot's modal opened for this member
export type TBotModalOpen = TBotModal & {
  interactionId: number;
  botId: number;
  channelId: number;
};
