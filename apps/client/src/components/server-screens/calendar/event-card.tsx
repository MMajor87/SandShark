import type { TRouterOutputs } from '@/lib/trpc';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@sharkord/ui';
import { Trash2 } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type TEvent = TRouterOutputs['calendar']['getAll']['events'][number];
const CalendarEventCard = memo(
  ({
    event,
    onDelete
  }: {
    event: TEvent;
    onDelete: (eventId: number) => Promise<void>;
  }) => {
    const { t, i18n } = useTranslation('calendar');
    const formatter = useMemo(
      () =>
        new Intl.DateTimeFormat(i18n.resolvedLanguage, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short'
        }),
      [i18n.resolvedLanguage]
    );
    const handleDelete = useCallback(
      () => onDelete(event.id),
      [event.id, onDelete]
    );
    const date = event.endsAt
      ? t('dateRange', {
          start: formatter.format(event.startsAt),
          end: formatter.format(event.endsAt)
        })
      : formatter.format(event.startsAt);
    return (
      <Card className="rounded-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-base">
                {event.title}
              </CardTitle>
              <CardDescription className="mt-1">{date}</CardDescription>
            </div>
            {event.canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground"
                title={t('delete')}
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {event.description && (
            <p className="whitespace-pre-wrap">{event.description}</p>
          )}
          <p className="text-muted-foreground">
            {t('organizedBy', { name: event.creatorName })}
          </p>
        </CardContent>
      </Card>
    );
  }
);
export { CalendarEventCard };
