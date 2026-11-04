import {
  BotButtonStyle,
  BotComponentType,
  zHttpUrl,
  type TBotActionRow,
  type TBotButton,
  type TBotComponentEmoji,
  type TBotEntitySelect,
  type TBotStringSelect
} from '@sandshark/shared';
import { z } from 'zod';

// discord's limits for the components of one message
const MAX_ROWS = 5;
const MAX_BUTTONS_PER_ROW = 5;

const zCustomId = z.string().min(1).max(100);

// discord names a custom emoji by id as well, which is dropped: only the name is shown
const zEmoji = z.object({
  name: z.string().min(1).max(100).nullable().optional(),
  id: z.string().nullable().optional(),
  animated: z.boolean().optional()
});

const zButton = z.object({
  type: z.literal(BotComponentType.BUTTON),
  style: z.number().int().min(1).max(5),
  label: z.string().max(80).optional(),
  emoji: zEmoji.optional(),
  custom_id: zCustomId.optional(),
  url: zHttpUrl.optional(),
  disabled: z.boolean().optional()
});

const zSelect = z.object({
  type: z.literal(BotComponentType.STRING_SELECT),
  custom_id: zCustomId,
  placeholder: z.string().max(150).optional(),
  min_values: z.number().int().min(0).max(25).optional(),
  max_values: z.number().int().min(1).max(25).optional(),
  disabled: z.boolean().optional(),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(100),
        value: z.string().min(1).max(100),
        description: z.string().max(100).optional(),
        emoji: zEmoji.optional(),
        default: z.boolean().optional()
      })
    )
    .min(1)
    .max(25)
});

// discord can also preselect default values, which are dropped: the member starts blank
const zEntitySelect = z.object({
  type: z.union([
    z.literal(BotComponentType.USER_SELECT),
    z.literal(BotComponentType.ROLE_SELECT),
    z.literal(BotComponentType.MENTIONABLE_SELECT),
    z.literal(BotComponentType.CHANNEL_SELECT)
  ]),
  custom_id: zCustomId,
  placeholder: z.string().max(150).optional(),
  min_values: z.number().int().min(0).max(25).optional(),
  max_values: z.number().int().min(1).max(25).optional(),
  disabled: z.boolean().optional(),
  channel_types: z.array(z.number().int()).optional()
});

const zActionRow = z.object({
  type: z.literal(BotComponentType.ACTION_ROW),
  components: z.array(z.union([zButton, zSelect, zEntitySelect])).min(1)
});

const zDiscordComponents = z.array(zActionRow).max(MAX_ROWS);

type TDiscordActionRow = z.infer<typeof zActionRow>;
type TDiscordButton = z.infer<typeof zButton>;
type TDiscordSelect = z.infer<typeof zSelect>;
type TDiscordEntitySelect = z.infer<typeof zEntitySelect>;

const isButtonValid = (button: TDiscordButton) => {
  const hasFace = !!button.label || !!button.emoji?.name;

  if (button.style === BotButtonStyle.LINK) {
    return hasFace && !!button.url && button.custom_id === undefined;
  }

  return hasFace && !!button.custom_id && button.url === undefined;
};

const isSelectValid = (select: TDiscordSelect) => {
  const min = select.min_values ?? 1;
  const max = select.max_values ?? 1;
  const values = new Set(select.options.map(({ value }) => value));

  return (
    min <= max &&
    max <= select.options.length &&
    values.size === select.options.length
  );
};

const isEntitySelectValid = (select: TDiscordEntitySelect) =>
  (select.min_values ?? 1) <= (select.max_values ?? 1);

// a row holds up to five buttons or one select menu, never both, and every custom id is
// unique across the message
const areComponentsValid = (rows: TDiscordActionRow[]) => {
  const customIds: string[] = [];

  for (const row of rows) {
    const selects = row.components.filter(
      (component) => component.type !== BotComponentType.BUTTON
    );

    if (selects.length > 0 && row.components.length > 1) return false;

    if (row.components.length > MAX_BUTTONS_PER_ROW) return false;

    for (const component of row.components) {
      if (component.type === BotComponentType.BUTTON) {
        if (!isButtonValid(component)) return false;
      } else if (component.type === BotComponentType.STRING_SELECT) {
        if (!isSelectValid(component)) return false;
      } else if (!isEntitySelectValid(component)) {
        return false;
      }

      if (component.custom_id !== undefined)
        customIds.push(component.custom_id);
    }
  }

  return new Set(customIds).size === customIds.length;
};

const toStoredEmoji = (
  emoji: z.infer<typeof zEmoji> | undefined
): TBotComponentEmoji | undefined =>
  emoji?.name ? { name: emoji.name } : undefined;

const toStoredComponent = (
  component: TDiscordActionRow['components'][number]
): TBotButton | TBotStringSelect | TBotEntitySelect => {
  if (component.type === BotComponentType.BUTTON) {
    return {
      type: BotComponentType.BUTTON,
      style: component.style as BotButtonStyle,
      label: component.label,
      emoji: toStoredEmoji(component.emoji),
      customId: component.custom_id,
      url: component.url,
      disabled: component.disabled ?? false
    };
  }

  if (component.type !== BotComponentType.STRING_SELECT) {
    return {
      type: component.type,
      customId: component.custom_id,
      placeholder: component.placeholder,
      minValues: component.min_values ?? 1,
      maxValues: component.max_values ?? 1,
      disabled: component.disabled ?? false,
      channelTypes: component.channel_types
    };
  }

  return {
    type: BotComponentType.STRING_SELECT,
    customId: component.custom_id,
    placeholder: component.placeholder,
    minValues: component.min_values ?? 1,
    maxValues: component.max_values ?? 1,
    disabled: component.disabled ?? false,
    options: component.options.map((option) => ({
      label: option.label,
      value: option.value,
      description: option.description,
      emoji: toStoredEmoji(option.emoji),
      default: option.default ?? false
    }))
  };
};

const toStoredComponents = (rows: TDiscordActionRow[]): TBotActionRow[] =>
  rows.map((row) => ({
    type: BotComponentType.ACTION_ROW,
    components: row.components.map(toStoredComponent)
  }));

const serializeEmoji = (emoji: TBotComponentEmoji | undefined) =>
  emoji ? { id: null, name: emoji.name, animated: false } : undefined;

const serializeComponent = (
  component: TBotActionRow['components'][number]
) => {
  if (component.type === BotComponentType.BUTTON) {
    return {
      type: BotComponentType.BUTTON,
      style: component.style,
      label: component.label,
      emoji: serializeEmoji(component.emoji),
      custom_id: component.customId,
      url: component.url,
      disabled: component.disabled
    };
  }

  if (component.type !== BotComponentType.STRING_SELECT) {
    return {
      type: component.type,
      custom_id: component.customId,
      placeholder: component.placeholder,
      min_values: component.minValues,
      max_values: component.maxValues,
      disabled: component.disabled,
      channel_types: component.channelTypes
    };
  }

  return {
    type: BotComponentType.STRING_SELECT,
    custom_id: component.customId,
    placeholder: component.placeholder,
    min_values: component.minValues,
    max_values: component.maxValues,
    disabled: component.disabled,
    options: component.options.map((option) => ({
      label: option.label,
      value: option.value,
      description: option.description,
      emoji: serializeEmoji(option.emoji),
      default: option.default
    }))
  };
};

const serializeComponents = (rows: TBotActionRow[]) =>
  rows.map((row) => ({
    type: BotComponentType.ACTION_ROW,
    components: row.components.map(serializeComponent)
  }));

// the button or select menu with this custom id, if the message still has it
const findComponent = (rows: TBotActionRow[] | null, customId: string) =>
  (rows ?? [])
    .flatMap((row) => row.components)
    .find((component) => component.customId === customId);

export {
  areComponentsValid,
  findComponent,
  serializeComponents,
  toStoredComponents,
  zDiscordComponents,
  type TDiscordActionRow
};
