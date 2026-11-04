// discord's message component types that sandshark has. user, role, mentionable and
// channel selects, text inputs and the newer layout components are not here yet
export enum BotComponentType {
  ACTION_ROW = 1,
  BUTTON = 2,
  STRING_SELECT = 3
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

export type TBotActionRow = {
  type: BotComponentType.ACTION_ROW;
  components: (TBotButton | TBotStringSelect)[];
};
