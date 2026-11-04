import { MessageNodeType, type TCommandArg } from '@sandshark/shared';
import { Node } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps
} from '@tiptap/react';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  safeJsonParse,
  serializePluginCommandText,
  type TPluginCommandValues
} from './helpers';
import { useCommandChip } from './use-command-chip';

type TPluginCommandAttrs = {
  pluginId: string;
  commandName: string;
  args: string;
  values: string;
};

type TPluginCommandOptions = {
  onSubmit?: () => void;
};

type TCommandArgInputProps = {
  arg: TCommandArg;
  value: string;
  onValueChange: (name: string, value: string) => void;
  handleKeyNavigation: (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => boolean;
};

const CommandArgInput = memo(
  ({
    arg,
    value,
    onValueChange,
    handleKeyNavigation
  }: TCommandArgInputProps) => {
    const { t } = useTranslation('common');

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
        onValueChange(arg.name, event.target.value),
      [onValueChange, arg.name]
    );

    const handleKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLSelectElement | HTMLInputElement>) => {
        if (handleKeyNavigation(event)) return;

        if (
          event.key === 'Escape' &&
          event.currentTarget instanceof HTMLInputElement
        ) {
          event.currentTarget.blur();
        }

        event.stopPropagation();
      },
      [handleKeyNavigation]
    );

    const requirement = arg.required
      ? t('commandArgRequired')
      : t('commandArgOptional');
    const placeholder = arg.description ?? requirement;

    if (arg.type === 'boolean') {
      return (
        <label
          className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5"
          title={arg.description}
        >
          <span className="text-[10px] text-muted-foreground">{arg.name}</span>
          <select
            className="h-5 rounded border bg-background px-1 text-[11px]"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          >
            <option value="">{requirement}</option>
            <option value="true">{t('commandArgYes')}</option>
            <option value="false">{t('commandArgNo')}</option>
          </select>
        </label>
      );
    }

    return (
      <label
        className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5"
        title={arg.description}
      >
        <span className="text-[10px] text-muted-foreground">{arg.name}</span>
        <input
          type={arg.type === 'number' ? 'number' : 'text'}
          value={value}
          placeholder={placeholder}
          className="h-5 min-w-18 rounded border bg-background px-1 text-[11px]"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
      </label>
    );
  }
);

const PluginCommandNodeView = memo(
  ({ node, updateAttributes, editor, getPos, extension }: NodeViewProps) => {
    const attrs = node.attrs as TPluginCommandAttrs;
    const { onSubmit } = extension.options as TPluginCommandOptions;
    const { wrapperRef, handleKeyNavigation } = useCommandChip({
      node,
      editor,
      getPos,
      onSubmit
    });

    const argDefs = useMemo(
      () => safeJsonParse<TCommandArg[]>(attrs.args, []),
      [attrs.args]
    );

    const values = useMemo(
      () => safeJsonParse<TPluginCommandValues>(attrs.values, {}),
      [attrs.values]
    );

    const setValue = (argName: string, value: string) => {
      const nextValues: TPluginCommandValues = {
        ...values,
        [argName]: value
      };

      updateAttributes({
        values: JSON.stringify(nextValues)
      });
    };

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

        {argDefs.map((arg) => (
          <CommandArgInput
            key={arg.name}
            arg={arg}
            value={values[arg.name] ?? ''}
            onValueChange={setValue}
            handleKeyNavigation={handleKeyNavigation}
          />
        ))}
      </NodeViewWrapper>
    );
  }
);

export const PluginCommandNode = Node.create({
  name: 'pluginCommand',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions(): TPluginCommandOptions {
    return { onSubmit: undefined };
  },

  addNodeView() {
    return ReactNodeViewRenderer(PluginCommandNodeView, { as: 'span' });
  },

  addAttributes() {
    return {
      pluginId: {
        default: '',
        parseHTML: (el: Element) => el.getAttribute('data-plugin-id') || '',
        renderHTML: (attrs: TPluginCommandAttrs) => ({
          'data-plugin-id': attrs.pluginId
        })
      },
      commandName: {
        default: '',
        parseHTML: (el: Element) => el.getAttribute('data-command-name') || '',
        renderHTML: (attrs: TPluginCommandAttrs) => ({
          'data-command-name': attrs.commandName
        })
      },
      args: {
        default: '[]',
        parseHTML: (el: Element) =>
          el.getAttribute('data-command-args') || '[]',
        renderHTML: (attrs: TPluginCommandAttrs) => ({
          'data-command-args': attrs.args
        })
      },
      values: {
        default: '{}',
        parseHTML: (el: Element) =>
          el.getAttribute('data-command-values') || '{}',
        renderHTML: (attrs: TPluginCommandAttrs) => ({
          'data-command-values': attrs.values
        })
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${MessageNodeType.PLUGIN_COMMAND}"]`
      }
    ];
  },

  renderHTML({ node }) {
    const attrs = node.attrs as TPluginCommandAttrs;
    const argDefs = safeJsonParse<TCommandArg[]>(attrs.args, []);
    const values = safeJsonParse<TPluginCommandValues>(attrs.values, {});

    return [
      'span',
      {
        'data-type': MessageNodeType.PLUGIN_COMMAND,
        'data-plugin-id': attrs.pluginId,
        'data-command-name': attrs.commandName,
        'data-command-args': attrs.args,
        'data-command-values': attrs.values,
        class: 'plugin-command'
      },
      serializePluginCommandText(attrs.commandName, argDefs, values)
    ];
  }
});
