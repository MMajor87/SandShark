import { useChannels } from '@/features/server/channels/hooks';
import { useRoles } from '@/features/server/roles/hooks';
import { useUsers } from '@/features/server/users/hooks';
import { discordChannelType } from '@/helpers/discord-channel-type';
import {
  BotCommandOptionType,
  type TBotCommandOption
} from '@sandshark/shared';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type TBotOptionInputProps = {
  option: TBotCommandOption;
  value: string;
  onValueChange: (name: string, value: string) => void;
  handleKeyNavigation: (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => boolean;
  // asks the bot for suggestions, for an option it completes
  onSuggest?: (name: string, typed: string) => Promise<TChoice[]>;
};

export type TChoice = { value: string; label: string };

// the bot is asked once typing pauses, not on every key
const SUGGEST_DELAY_MS = 300;

const SELECT_CLASS =
  'h-5 max-w-40 rounded border bg-background px-1 text-[11px]';

// the field for one option of a bot command, picked from the server's own members,
// channels and roles where discord would offer a picker
const BotOptionInput = memo(
  ({
    option,
    value,
    onValueChange,
    handleKeyNavigation,
    onSuggest
  }: TBotOptionInputProps) => {
    const { t } = useTranslation('common');
    const users = useUsers();
    const channels = useChannels();
    const roles = useRoles();

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
        onValueChange(option.name, event.target.value),
      [onValueChange, option.name]
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

    const memberChoices = useMemo<TChoice[]>(
      () =>
        users
          .filter((user) => !user.banned)
          .map((user) => ({ value: String(user.id), label: user.name })),
      [users]
    );

    const roleChoices = useMemo<TChoice[]>(
      () => roles.map((role) => ({ value: String(role.id), label: role.name })),
      [roles]
    );

    const choices = useMemo<TChoice[] | undefined>(() => {
      if (option.choices) {
        return option.choices.map((choice) => ({
          value: String(choice.value),
          label: choice.name
        }));
      }

      if (option.type === BotCommandOptionType.USER) return memberChoices;

      if (option.type === BotCommandOptionType.ROLE) return roleChoices;

      if (option.type === BotCommandOptionType.CHANNEL) {
        return channels
          .filter(
            (channel) =>
              !channel.isDm &&
              (!option.channelTypes ||
                option.channelTypes.includes(discordChannelType(channel)))
          )
          .map((channel) => ({
            value: String(channel.id),
            label: channel.name
          }));
      }

      if (option.type === BotCommandOptionType.BOOLEAN) {
        return [
          { value: 'true', label: t('commandArgYes') },
          { value: 'false', label: t('commandArgNo') }
        ];
      }

      return undefined;
    }, [option, memberChoices, roleChoices, channels, t]);

    const suggestId = useId();
    const [suggestions, setSuggestions] = useState<TChoice[]>([]);

    useEffect(() => {
      if (!option.autocomplete || !onSuggest) return;

      let cancelled = false;
      const timer = setTimeout(async () => {
        const choices = await onSuggest(option.name, value);

        if (!cancelled) setSuggestions(choices);
      }, SUGGEST_DELAY_MS);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [option.autocomplete, option.name, onSuggest, value]);

    const requirement = option.required
      ? t('commandArgRequired')
      : t('commandArgOptional');

    if (option.type === BotCommandOptionType.MENTIONABLE) {
      return (
        <label
          className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5"
          title={option.description}
        >
          <span className="text-[10px] text-muted-foreground">
            {option.name}
          </span>
          <select
            className={SELECT_CLASS}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          >
            <option value="">{requirement}</option>
            <optgroup label={t('botCommandMembers')}>
              {memberChoices.map((choice) => (
                <option key={choice.value} value={`user:${choice.value}`}>
                  {choice.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('botCommandRoles')}>
              {roleChoices.map((choice) => (
                <option key={choice.value} value={`role:${choice.value}`}>
                  {choice.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      );
    }

    if (choices) {
      return (
        <label
          className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5"
          title={option.description}
        >
          <span className="text-[10px] text-muted-foreground">
            {option.name}
          </span>
          <select
            className={SELECT_CLASS}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          >
            <option value="">{requirement}</option>
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    const isNumber =
      option.type === BotCommandOptionType.INTEGER ||
      option.type === BotCommandOptionType.NUMBER;
    const listId = suggestions.length > 0 ? `${suggestId}-list` : undefined;

    return (
      <label
        className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5"
        title={option.description}
      >
        <span className="text-[10px] text-muted-foreground">{option.name}</span>
        <input
          type={isNumber ? 'number' : 'text'}
          step={option.type === BotCommandOptionType.INTEGER ? 1 : undefined}
          min={option.minValue}
          max={option.maxValue}
          maxLength={option.maxLength}
          value={value}
          placeholder={option.description || requirement}
          className="h-5 min-w-18 rounded border bg-background px-1 text-[11px]"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          list={listId}
        />
        {listId && (
          <datalist id={listId}>
            {suggestions.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </datalist>
        )}
      </label>
    );
  }
);

export { BotOptionInput };
