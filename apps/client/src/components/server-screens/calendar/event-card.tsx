import {
  CalendarResponseStatus,
  TestId,
  type TJoinedCalendarEvent
} from '@sandshark/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@sandshark/ui';
import { Pencil, Trash2 } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalendarDateFormatter } from './hooks/use-calendar-date-formatter';

const CARD_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short'
};

const RESPONSE_STATUSES = [
  CalendarResponseStatus.GOING,
  CalendarResponseStatus.MAYBE,
  CalendarResponseStatus.DECLINED
];

type TResponseButtonProps = {
  eventId: number;
  status: CalendarResponseStatus;
  selected: boolean;
  onRespond: (eventId: number, status: CalendarResponseStatus) => void;
};

const ResponseButton = memo(
  ({ eventId, status, selected, onRespond }: TResponseButtonProps) => {
    const { t } = useTranslation('calendar');

    const handleClick = useCallback(
      () => onRespond(eventId, status),
      [eventId, status, onRespond]
    );

    return (
      <Button
        size="sm"
        variant={selected ? 'default' : 'outline'}
        aria-pressed={selected}
        data-testid={TestId.CALENDAR_RSVP}
        data-status={status}
        onClick={handleClick}
      >
        {t(`response_${status}`)}
      </Button>
    );
  }
);

type TCalendarEventCardProps = {
  event: TJoinedCalendarEvent;
  onDelete: (eventId: number) => Promise<void>;
  onEdit: (event: TJoinedCalendarEvent) => void;
  onRespond: (eventId: number, status: CalendarResponseStatus) => void;
};

const CalendarEventCard = memo(
  ({ event, onDelete, onEdit, onRespond }: TCalendarEventCardProps) => {
    const { t } = useTranslation('calendar');
    const formatter = useCalendarDateFormatter(CARD_DATE_OPTIONS);

    const handleDelete = useCallback(
      () => onDelete(event.id),
      [event.id, onDelete]
    );

    const handleEdit = useCallback(() => onEdit(event), [event, onEdit]);

    const date = event.endsAt
      ? t('dateRange', {
          start: formatter.format(event.startsAt),
          end: formatter.format(event.endsAt)
        })
      : formatter.format(event.startsAt);

    return (
      <Card className="rounded-md" data-testid={TestId.CALENDAR_EVENT_CARD}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-base">
                {event.title}
              </CardTitle>
              <CardDescription className="mt-1">{date}</CardDescription>
            </div>
            <div className="flex shrink-0 gap-1">
              {event.canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  title={t('edit')}
                  aria-label={t('edit')}
                  data-testid={TestId.CALENDAR_EVENT_EDIT}
                  onClick={handleEdit}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {event.canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  title={t('delete')}
                  aria-label={t('delete')}
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {event.description && (
            <p className="whitespace-pre-wrap">{event.description}</p>
          )}
          <p className="text-muted-foreground">
            {t('organizedBy', { name: event.creatorName })}
          </p>
          {event.invitees.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">
                {t('invited')}
              </p>
              <div className="flex flex-wrap gap-1">
                {event.invitees.map((invitee) => (
                  <Badge
                    key={`${invitee.type}:${invitee.id}`}
                    variant="secondary"
                  >
                    {invitee.type === 'role'
                      ? `@${invitee.name}`
                      : invitee.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {t('responseSummary', event.responseCounts)}
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t('yourResponse')}
          >
            {RESPONSE_STATUSES.map((status) => (
              <ResponseButton
                key={status}
                eventId={event.id}
                status={status}
                selected={event.ownResponse === status}
                onRespond={onRespond}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
);

export { CalendarEventCard };
