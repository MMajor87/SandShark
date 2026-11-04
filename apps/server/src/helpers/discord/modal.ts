import {
  BotComponentType,
  BotTextInputStyle,
  type TBotModal
} from '@sandshark/shared';
import { z } from 'zod';

const MAX_INPUT_LENGTH = 4_000;

const zCustomId = z.string().min(1).max(100);

const zTextInput = z.object({
  type: z.literal(BotComponentType.TEXT_INPUT),
  custom_id: zCustomId,
  style: z.number().int().min(1).max(2).optional(),
  label: z.string().min(1).max(45).optional(),
  min_length: z.number().int().min(0).max(MAX_INPUT_LENGTH).optional(),
  max_length: z.number().int().min(1).max(MAX_INPUT_LENGTH).optional(),
  required: z.boolean().optional(),
  value: z.string().max(MAX_INPUT_LENGTH).optional(),
  placeholder: z.string().max(100).optional()
});

// the older shape: an action row holding one text input that carries its own label
const zInputRow = z.object({
  type: z.literal(BotComponentType.ACTION_ROW),
  components: z.array(zTextInput).length(1)
});

// the newer shape: a label wrapping its text input
const zLabel = z.object({
  type: z.literal(BotComponentType.LABEL),
  label: z.string().min(1).max(45),
  description: z.string().max(100).optional(),
  component: zTextInput
});

const zDiscordModal = z.object({
  custom_id: zCustomId,
  title: z.string().min(1).max(45),
  components: z
    .array(z.union([zInputRow, zLabel]))
    .min(1)
    .max(5)
});

type TDiscordModal = z.infer<typeof zDiscordModal>;

// one shape for every input, a label on each, unique custom ids, and lengths that fit
const toStoredModal = (modal: TDiscordModal): TBotModal | undefined => {
  const labelled = modal.components[0]!.type === BotComponentType.LABEL;
  const inputs: TBotModal['inputs'] = [];

  for (const item of modal.components) {
    const isLabel = item.type === BotComponentType.LABEL;

    if (isLabel !== labelled) return undefined;

    const input = isLabel ? item.component : item.components[0]!;
    const label = isLabel ? item.label : input.label;

    if (!label) return undefined;

    if ((input.min_length ?? 0) > (input.max_length ?? MAX_INPUT_LENGTH)) {
      return undefined;
    }

    if (
      input.value &&
      input.value.length > (input.max_length ?? MAX_INPUT_LENGTH)
    ) {
      return undefined;
    }

    inputs.push({
      customId: input.custom_id,
      label,
      description: isLabel ? item.description : undefined,
      style: (input.style ?? BotTextInputStyle.SHORT) as BotTextInputStyle,
      required: input.required ?? true,
      minLength: input.min_length,
      maxLength: input.max_length,
      placeholder: input.placeholder,
      value: input.value
    });
  }

  const customIds = new Set(inputs.map(({ customId }) => customId));

  if (customIds.size !== inputs.length) return undefined;

  return { customId: modal.custom_id, title: modal.title, labelled, inputs };
};

// what the member filled in, in the shape the bot sent the modal in
const serializeModalSubmit = (
  modal: Pick<TBotModal, 'labelled'>,
  values: { customId: string; value: string }[]
) =>
  values.map(({ customId, value }) => {
    const input = {
      type: BotComponentType.TEXT_INPUT,
      custom_id: customId,
      value
    };

    if (modal.labelled) {
      return { type: BotComponentType.LABEL, component: input };
    }

    return { type: BotComponentType.ACTION_ROW, components: [input] };
  });

export { MAX_INPUT_LENGTH, serializeModalSubmit, toStoredModal, zDiscordModal };
