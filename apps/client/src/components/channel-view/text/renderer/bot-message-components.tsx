import { getTRPCClient } from '@/lib/trpc';
import {
  BotButtonStyle,
  BotComponentType,
  getTrpcError,
  type TBotActionRow,
  type TBotButton,
  type TBotStringSelect
} from '@sandshark/shared';
import { Button, Spinner } from '@sandshark/ui';
import { ExternalLink } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// the message a component is on: a channel message, or an ephemeral answer
type TComponentTarget = { messageId: number } | { ephemeralMessageId: number };

type TPress = (customId: string, values?: string[]) => Promise<void>;

// the bot answers through its own interaction, so pressing only has to reach the server
const usePressBotComponent = (target: TComponentTarget): TPress => {
  const { t } = useTranslation();

  return useCallback(
    async (customId: string, values: string[] = []) => {
      try {
        const trpc = getTRPCClient();

        await trpc.bots.pressComponent.mutate({ ...target, customId, values });
      } catch (error) {
        toast.error(getTrpcError(error, t('failedUseComponent')));
      }
    },
    [target, t]
  );
};

const BUTTON_VARIANTS = {
  [BotButtonStyle.PRIMARY]: 'default',
  [BotButtonStyle.SECONDARY]: 'secondary',
  [BotButtonStyle.SUCCESS]: 'default',
  [BotButtonStyle.DANGER]: 'destructive',
  [BotButtonStyle.LINK]: 'outline'
} as const;

// the ui kit has no green button, discord's success style is drawn here
const SUCCESS_CLASS = 'bg-green-600 text-white hover:bg-green-600/90';

type TBotButtonProps = {
  button: TBotButton;
  press: TPress;
};

const BotComponentButton = memo(({ button, press }: TBotButtonProps) => {
  const [pending, setPending] = useState(false);

  const onClick = useCallback(async () => {
    if (!button.customId) return;

    setPending(true);
    await press(button.customId);
    setPending(false);
  }, [button.customId, press]);

  const face = (
    <>
      {button.emoji && <span>{button.emoji.name}</span>}
      {button.label && <span>{button.label}</span>}
    </>
  );

  if (button.style === BotButtonStyle.LINK && button.url) {
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={button.url} target="_blank" rel="noopener noreferrer">
          {face}
          <ExternalLink className="size-3" />
        </a>
      </Button>
    );
  }

  return (
    <Button
      variant={BUTTON_VARIANTS[button.style]}
      size="sm"
      className={
        button.style === BotButtonStyle.SUCCESS ? SUCCESS_CLASS : undefined
      }
      disabled={button.disabled || pending}
      onClick={onClick}
    >
      {pending && <Spinner size="xs" />}
      {face}
    </Button>
  );
});

type TBotSelectProps = {
  select: TBotStringSelect;
  press: TPress;
};

// a menu allowing one choice sends it as soon as it is made
const BotSingleSelect = memo(({ select, press }: TBotSelectProps) => {
  const [pending, setPending] = useState(false);

  const onChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      const { value } = event.target;

      if (!value) return;

      setPending(true);
      await press(select.customId, [value]);
      setPending(false);
    },
    [press, select.customId]
  );

  return (
    <select
      className="h-8 max-w-xs rounded-md border bg-background px-2 text-sm"
      disabled={select.disabled || pending}
      value=""
      onChange={onChange}
    >
      <option value="">{select.placeholder ?? ''}</option>
      {select.options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          title={option.description}
        >
          {option.emoji ? `${option.emoji.name} ` : ''}
          {option.label}
        </option>
      ))}
    </select>
  );
});

type TBotSelectOptionProps = {
  label: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (value: string) => void;
};

const BotSelectOption = memo(
  ({ label, value, checked, disabled, onToggle }: TBotSelectOptionProps) => {
    const onChange = useCallback(() => onToggle(value), [onToggle, value]);

    return (
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
        />
        {label}
      </label>
    );
  }
);

// a menu allowing several choices collects them and sends them together
const BotMultiSelect = memo(({ select, press }: TBotSelectProps) => {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [chosen, setChosen] = useState<string[]>(() =>
    select.options.filter((option) => option.default).map(({ value }) => value)
  );

  const onToggle = useCallback(
    (value: string) =>
      setChosen((current) =>
        current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value]
      ),
    []
  );

  const onApply = useCallback(async () => {
    setPending(true);
    await press(select.customId, chosen);
    setPending(false);
  }, [press, select.customId, chosen]);

  const canApply =
    chosen.length >= select.minValues && chosen.length <= select.maxValues;
  const disabled = select.disabled || pending;

  return (
    <div className="flex max-w-xs flex-col gap-1 rounded-md border p-2">
      {select.placeholder && (
        <span className="text-xs text-muted-foreground">
          {select.placeholder}
        </span>
      )}
      {select.options.map((option) => (
        <BotSelectOption
          key={option.value}
          label={option.label}
          value={option.value}
          checked={chosen.includes(option.value)}
          disabled={disabled}
          onToggle={onToggle}
        />
      ))}
      <Button
        size="sm"
        className="self-start"
        disabled={disabled || !canApply}
        onClick={onApply}
      >
        {pending && <Spinner size="xs" />}
        {t('botSelectApply')}
      </Button>
    </div>
  );
});

type TBotMessageComponentsProps = {
  rows: TBotActionRow[] | null;
  messageId?: number;
  ephemeralMessageId?: number;
};

// a bot's buttons and select menus, a row at a time as discord lays them out
const BotMessageComponents = memo(
  ({ rows, messageId, ephemeralMessageId }: TBotMessageComponentsProps) => {
    const target = useMemo<TComponentTarget>(
      () =>
        ephemeralMessageId === undefined
          ? { messageId: messageId! }
          : { ephemeralMessageId },
      [messageId, ephemeralMessageId]
    );
    const press = usePressBotComponent(target);

    if (!rows?.length) return null;

    return (
      <div className="flex flex-col gap-1.5">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex flex-wrap items-center gap-1.5">
            {row.components.map((component, index) => {
              if (component.type === BotComponentType.BUTTON) {
                return (
                  <BotComponentButton
                    key={index}
                    button={component}
                    press={press}
                  />
                );
              }

              if (component.maxValues > 1) {
                return (
                  <BotMultiSelect
                    key={index}
                    select={component}
                    press={press}
                  />
                );
              }

              return (
                <BotSingleSelect key={index} select={component} press={press} />
              );
            })}
          </div>
        ))}
      </div>
    );
  }
);

export { BotMessageComponents };
