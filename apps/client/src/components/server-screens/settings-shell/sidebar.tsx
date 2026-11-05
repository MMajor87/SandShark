import { cn } from '@/lib/utils';
import { TestId } from '@sandshark/shared';
import { Tooltip } from '@sandshark/ui';
import { AlertCircle } from 'lucide-react';

import { memo, useCallback, useMemo } from 'react';
import { groupSettingsEntries } from './helpers';
import type { TSettingsEntry } from './types';

type TSidebarEntryProps = {
  entry: TSettingsEntry;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

const SidebarEntry = memo(
  ({ entry, isSelected, onSelect }: TSidebarEntryProps) => {
    const { icon: Icon, logo, label, error, tone } = entry;

    const handleClick = useCallback(
      () => onSelect(entry.id),
      [onSelect, entry.id]
    );

    return (
      <button
        type="button"
        data-testid={TestId.SETTINGS_SIDEBAR_ENTRY}
        onClick={handleClick}
        aria-current={isSelected ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring',
          isSelected &&
            'bg-highlight-soft font-medium text-foreground shadow-[inset_3px_0_0_0_var(--highlight)] hover:bg-highlight-soft hover:text-foreground [&>svg:first-child]:text-highlight',
          tone === 'danger' &&
            'text-destructive hover:text-destructive [&>svg:first-child]:text-destructive'
        )}
      >
        {logo ? (
          <img
            src={logo}
            alt=""
            className="h-4 w-4 shrink-0 rounded-sm object-cover"
          />
        ) : (
          <Icon className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{label}</span>
        {error && (
          <Tooltip content={error}>
            <AlertCircle
              role="img"
              aria-label={error}
              className="ml-auto h-4 w-4 shrink-0 text-destructive"
            />
          </Tooltip>
        )}
      </button>
    );
  }
);

type TSettingsSidebarProps = {
  entries: TSettingsEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
};

const SettingsSidebar = memo(
  ({ entries, selectedId, onSelect, className }: TSettingsSidebarProps) => {
    const groups = useMemo(() => groupSettingsEntries(entries), [entries]);

    return (
      <nav
        className={cn(
          'w-60 shrink-0 space-y-4 overflow-y-auto border-r bg-background p-3',
          className
        )}
      >
        {groups.map(({ label, entries: groupEntries }, index) => (
          <div key={label ?? `group-${index}`} className="space-y-1">
            {label && (
              <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </h2>
            )}
            {groupEntries.map((entry) => (
              <SidebarEntry
                key={entry.id}
                entry={entry}
                isSelected={entry.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </nav>
    );
  }
);

export { SettingsSidebar };
