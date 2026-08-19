import { useRoles } from '@/features/server/roles/hooks';
import { useUsers } from '@/features/server/users/hooks';
import { getTRPCClient } from '@/lib/trpc';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  Textarea
} from '@sharkord/ui';
import { CalendarDays, Plus, Trash2, Users } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { TServerScreenBaseProps } from '../screens';
import { ServerScreenLayout } from '../server-screen-layout';

type TCalendarEvent = {
  id: number;
  title: string;
  description: string | null;
  startsAt: number;
  endsAt: number | null;
  creatorId: number;
  creatorName: string;
  canDelete: boolean;
};

type TTarget = { type: 'user' | 'role'; id: number };

const localDateTimeValue = (time: number) => {
  const date = new Date(time - new Date(time).getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
};

const formatDateTime = (time: number) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(time);

const CalendarScreen = memo(({ close }: TServerScreenBaseProps) => {
  const users = useUsers();
  const roles = useRoles();
  const [events, setEvents] = useState<TCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(() =>
    localDateTimeValue(Date.now() + 60 * 60 * 1000)
  );
  const [endsAt, setEndsAt] = useState('');
  const [targets, setTargets] = useState<TTarget[]>([]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getTRPCClient().calendar.getAll.query();
      setEvents(items);
    } catch {
      toast.error('Could not load calendar events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const selectedTargets = useMemo(
    () => new Set(targets.map((target) => `${target.type}:${target.id}`)),
    [targets]
  );

  const toggleTarget = useCallback((target: TTarget) => {
    const key = `${target.type}:${target.id}`;
    setTargets((current) =>
      current.some((item) => `${item.type}:${item.id}` === key)
        ? current.filter((item) => `${item.type}:${item.id}` !== key)
        : [...current, target]
    );
  }, []);

  const createEvent = useCallback(async () => {
    const startTime = new Date(startsAt).getTime();
    const endTime = endsAt ? new Date(endsAt).getTime() : undefined;

    if (!title.trim() || !Number.isFinite(startTime) || targets.length === 0) {
      toast.error('Add a title, a start time, and at least one invitee.');
      return;
    }

    if (endTime && endTime <= startTime) {
      toast.error('The end time must be after the start time.');
      return;
    }

    setSubmitting(true);
    try {
      await getTRPCClient().calendar.create.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        startsAt: startTime,
        endsAt: endTime,
        targets
      });
      setTitle('');
      setDescription('');
      setEndsAt('');
      setTargets([]);
      await loadEvents();
      toast.success('Event created and invitations sent.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not create event.'
      );
    } finally {
      setSubmitting(false);
    }
  }, [description, endsAt, loadEvents, startsAt, targets, title]);

  const deleteEvent = useCallback(async (eventId: number) => {
    try {
      await getTRPCClient().calendar.delete.mutate({ eventId });
      setEvents((current) => current.filter((event) => event.id !== eventId));
      toast.success('Event deleted.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not delete event.'
      );
    }
  }, []);

  return (
    <ServerScreenLayout close={close} title="Calendar">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Upcoming events</h2>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading events...</p>
          ) : events.length === 0 ? (
            <div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No upcoming invitations yet.
            </div>
          ) : (
            events.map((event) => (
              <Card key={event.id} className="rounded-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">
                        {event.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {formatDateTime(event.startsAt)}
                        {event.endsAt
                          ? ` to ${formatDateTime(event.endsAt)}`
                          : ''}
                      </CardDescription>
                    </div>
                    {event.canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground"
                        title="Delete event"
                        onClick={() => void deleteEvent(event.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {(event.description || event.creatorName) && (
                  <CardContent className="space-y-2 text-sm">
                    {event.description && (
                      <p className="whitespace-pre-wrap">{event.description}</p>
                    )}
                    <p className="text-muted-foreground">
                      Organized by {event.creatorName}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </section>

        <Card className="h-fit rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" /> Create event
            </CardTitle>
            <CardDescription>
              Times are shown to each invitee in their local timezone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calendar-title">Title</Label>
              <Input
                id="calendar-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-description">Description</Label>
              <Textarea
                id="calendar-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-start">Starts</Label>
              <Input
                id="calendar-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-end">Ends (optional)</Label>
              <Input
                id="calendar-end"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Invite members or groups
              </Label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {users.map((user) => {
                  const key = `user:${user.id}`;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Switch
                        checked={selectedTargets.has(key)}
                        onCheckedChange={() =>
                          toggleTarget({ type: 'user', id: user.id })
                        }
                      />
                      {user.name}
                    </label>
                  );
                })}
                {roles.map((role) => {
                  const key = `role:${role.id}`;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Switch
                        checked={selectedTargets.has(key)}
                        onCheckedChange={() =>
                          toggleTarget({ type: 'role', id: role.id })
                        }
                      />
                      @{role.name}
                    </label>
                  );
                })}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={submitting}
              onClick={() => void createEvent()}
            >
              {submitting ? 'Creating...' : 'Create event'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </ServerScreenLayout>
  );
});

export { CalendarScreen };
