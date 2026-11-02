import type { LucideIcon } from 'lucide-react';
import { memo, type ReactNode } from 'react';

type TViewHeaderProps = {
  icon?: LucideIcon;
  title?: string;
  actions?: ReactNode;
};

const ViewHeader = memo(({ icon: Icon, title, actions }: TViewHeaderProps) => (
  <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4 shadow-sm">
    <div className="flex min-w-0 items-center gap-2">
      {Icon && <Icon className="size-5 shrink-0 text-muted-foreground" />}
      {title && <span className="truncate font-semibold">{title}</span>}
    </div>
    {actions}
  </div>
));

export { ViewHeader };
