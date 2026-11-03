import type { TCalendarTarget } from '@sandshark/shared';
import { Switch } from '@sandshark/ui';
import { memo, useCallback } from 'react';

const InviteTarget = memo(
  ({
    id,
    type,
    name,
    checked,
    onToggle
  }: TCalendarTarget & {
    name: string;
    checked: boolean;
    onToggle: (target: TCalendarTarget) => void;
  }) => {
    const toggle = useCallback(
      () => onToggle({ id, type }),
      [id, type, onToggle]
    );
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Switch checked={checked} onCheckedChange={toggle} />
        {name}
      </label>
    );
  }
);
export { InviteTarget };
