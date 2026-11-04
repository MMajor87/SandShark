import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { SuggestionList, type TSuggestionListRef } from '../suggestion-list';
import { isBotCommand, type TSlashCommand } from './helpers';

type TCommandListProps = {
  items: TSlashCommand[];
  onSelect: (item: TSlashCommand) => void;
  ref?: Ref<TSuggestionListRef>;
};

const getKey = (item: TSlashCommand) =>
  isBotCommand(item)
    ? `bot:${item.commandId}:${item.name}`
    : `${item.pluginId}:${item.name}`;

const renderItem = (item: TSlashCommand) => {
  const isBot = isBotCommand(item);
  const providerName = isBot ? item.botName : item.pluginName;
  const logo = isBot ? undefined : item.pluginLogo;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground shrink-0">/</span>
        <span className="font-medium truncate">{item.name}</span>
        <span className="ml-auto flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
          {logo && (
            <img
              src={logo}
              alt=""
              className="size-3 shrink-0 rounded-sm object-cover"
            />
          )}
          <span className="truncate">{providerName}</span>
        </span>
      </div>
      {item.description && (
        <span className="text-xs text-muted-foreground truncate">
          {item.description}
        </span>
      )}
    </>
  );
};

const CommandList = ({ items, onSelect, ref }: TCommandListProps) => {
  const { t } = useTranslation('common');

  return (
    <SuggestionList
      ref={ref}
      items={items}
      onSelect={onSelect}
      getKey={getKey}
      renderItem={renderItem}
      ariaLabel={t('runCommand')}
      className="min-w-[16rem] max-w-[22rem]"
      itemClassName="flex-col items-stretch gap-0.5"
    />
  );
};

export { CommandList };
