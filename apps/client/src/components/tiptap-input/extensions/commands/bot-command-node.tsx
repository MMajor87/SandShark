import {
  BotCommandOptionType,
  MessageNodeType,
  type TBotCommandOption
} from '@sandshark/shared';
import { Node } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps
} from '@tiptap/react';
import { memo, useCallback, useMemo } from 'react';
import { BotOptionInput } from './bot-option-input';
import {
  safeJsonParse,
  serializeBotCommandText,
  type TPluginCommandValues
} from './helpers';
import { useCommandChip } from './use-command-chip';

type TBotCommandAttrs = {
  commandId: number;
  commandName: string;
  subcommand: string;
  options: string;
  values: string;
};

type TBotCommandOptions = {
  onSubmit?: () => void;
};

// a member cannot hand a bot a file yet, and commands that need one are not offered
const isFillable = (option: TBotCommandOption) =>
  option.type !== BotCommandOptionType.ATTACHMENT;

const BotCommandNodeView = memo(
  ({ node, updateAttributes, editor, getPos, extension }: NodeViewProps) => {
    const attrs = node.attrs as TBotCommandAttrs;
    const { onSubmit } = extension.options as TBotCommandOptions;
    const { wrapperRef, handleKeyNavigation } = useCommandChip({
      node,
      editor,
      getPos,
      onSubmit
    });

    const options = useMemo(
      () =>
        safeJsonParse<TBotCommandOption[]>(attrs.options, []).filter(
          isFillable
        ),
      [attrs.options]
    );

    const values = useMemo(
      () => safeJsonParse<TPluginCommandValues>(attrs.values, {}),
      [attrs.values]
    );

    const setValue = useCallback(
      (name: string, value: string) => {
        updateAttributes({
          values: JSON.stringify({ ...values, [name]: value })
        });
      },
      [updateAttributes, values]
    );

    return (
      <NodeViewWrapper
        as="span"
        ref={wrapperRef}
        className="inline-flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 align-middle"
        contentEditable={false}
      >
        <span className="text-xs text-muted-foreground shrink-0">/</span>
        <span className="text-xs font-medium shrink-0">
          {attrs.commandName}
        </span>

        {options.map((option) => (
          <BotOptionInput
            key={option.name}
            option={option}
            value={values[option.name] ?? ''}
            onValueChange={setValue}
            handleKeyNavigation={handleKeyNavigation}
          />
        ))}
      </NodeViewWrapper>
    );
  }
);

// the node's own renderHTML writes every data attribute, so the attributes add none
const stringAttribute = (name: string, fallback: string) => ({
  default: fallback,
  parseHTML: (element: Element) => element.getAttribute(name) || fallback,
  renderHTML: () => ({})
});

// a bot command is run by its id, not by its name, so two bots or a bot and a plugin can
// share a name. the node carries the id and the options the server checks the values against
export const BotCommandNode = Node.create({
  name: 'botCommand',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions(): TBotCommandOptions {
    return { onSubmit: undefined };
  },

  addNodeView() {
    return ReactNodeViewRenderer(BotCommandNodeView, { as: 'span' });
  },

  addAttributes() {
    return {
      commandId: {
        default: 0,
        parseHTML: (element: Element) =>
          Number(element.getAttribute('data-command-id')),
        renderHTML: () => ({})
      },
      commandName: stringAttribute('data-command-name', ''),
      subcommand: stringAttribute('data-command-subcommand', '[]'),
      options: stringAttribute('data-command-options', '[]'),
      values: stringAttribute('data-command-values', '{}')
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${MessageNodeType.BOT_COMMAND}"]` }];
  },

  renderHTML({ node }) {
    const attrs = node.attrs as TBotCommandAttrs;
    const options = safeJsonParse<TBotCommandOption[]>(attrs.options, []);
    const values = safeJsonParse<TPluginCommandValues>(attrs.values, {});

    return [
      'span',
      {
        'data-type': MessageNodeType.BOT_COMMAND,
        'data-command-id': String(attrs.commandId),
        'data-command-name': attrs.commandName,
        'data-command-subcommand': attrs.subcommand,
        'data-command-options': attrs.options,
        'data-command-values': attrs.values,
        class: 'bot-command'
      },
      serializeBotCommandText(attrs.commandName, options, values)
    ];
  }
});
