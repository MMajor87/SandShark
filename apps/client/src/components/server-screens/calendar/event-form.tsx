import { useRoles } from '@/features/server/roles/hooks';
import { useOwnUserId, useUsers } from '@/features/server/users/hooks';
import { getTRPCClient } from '@/lib/trpc';
import {
  DELETED_USER_IDENTITY_AND_NAME,
  getTrpcError,
  TestId,
  zCalendarEventInput,
  type TCalendarTarget,
  type TJoinedCalendarEvent
} from '@sandshark/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea
} from '@sandshark/ui';
import { Pencil, Plus, Users } from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { InviteTarget } from './invite-target';

const localDateTimeValue = (time: number) =>
  new Date(time - new Date(time).getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
const toTargets = (event: TJoinedCalendarEvent): TCalendarTarget[] =>
  event.invitees.map(({ type, id }) => ({ type, id }));

// editingEvent is set when editing, and the screen remounts the form with a new key for
// each event so the fields start from that event
type TEventFormProps = {
  editingEvent?: TJoinedCalendarEvent;
  onSaved: () => Promise<void>;
  onCancelEdit: () => void;
};

const EventForm = memo(
  ({ editingEvent, onSaved, onCancelEdit }: TEventFormProps) => {
    const { t } = useTranslation('calendar');
    const users = useUsers();
    const ownUserId = useOwnUserId();
    // the organizer always sees their own event, and a deleted account cannot attend
    const invitableUsers = useMemo(
      () =>
        users.filter(
          (user) =>
            user.id !== ownUserId &&
            user.name !== DELETED_USER_IDENTITY_AND_NAME
        ),
      [users, ownUserId]
    );
    const roles = useRoles();
    const [submitting, setSubmitting] = useState(false);
    const active = useRef(true);
    useEffect(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []);
    const busy = useRef(false);
    const [title, setTitle] = useState(editingEvent?.title ?? '');
    const [description, setDescription] = useState(
      editingEvent?.description ?? ''
    );
    const [startsAt, setStartsAt] = useState(() =>
      localDateTimeValue(editingEvent?.startsAt ?? Date.now() + 3_600_000)
    );
    const [endsAt, setEndsAt] = useState(() =>
      editingEvent?.endsAt ? localDateTimeValue(editingEvent.endsAt) : ''
    );
    const [targets, setTargets] = useState<TCalendarTarget[]>(() =>
      editingEvent ? toTargets(editingEvent) : []
    );
    const selectedTargets = useMemo(
      () => new Set(targets.map((target) => `${target.type}:${target.id}`)),
      [targets]
    );
    const toggleTarget = useCallback((target: TCalendarTarget) => {
      const key = `${target.type}:${target.id}`;
      setTargets((current) =>
        current.some((item) => `${item.type}:${item.id}` === key)
          ? current.filter((item) => `${item.type}:${item.id}` !== key)
          : [...current, target]
      );
    }, []);
    const changeTitle = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value),
      []
    );
    const changeDescription = useCallback(
      (event: ChangeEvent<HTMLTextAreaElement>) =>
        setDescription(event.target.value),
      []
    );
    const changeStart = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => setStartsAt(event.target.value),
      []
    );
    const changeEnd = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => setEndsAt(event.target.value),
      []
    );
    const saveEvent = useCallback(async () => {
      if (busy.current) return;
      const result = zCalendarEventInput.safeParse({
        title,
        description,
        startsAt: new Date(startsAt).getTime(),
        endsAt: endsAt ? new Date(endsAt).getTime() : undefined,
        targets
      });
      if (!result.success) {
        toast.error(t('invalidEvent'));
        return;
      }
      busy.current = true;
      setSubmitting(true);
      try {
        const trpc = getTRPCClient();
        if (editingEvent) {
          await trpc.calendar.update.mutate({
            ...result.data,
            eventId: editingEvent.id
          });
        } else {
          await trpc.calendar.create.mutate(result.data);
        }
        if (!active.current || getTRPCClient() !== trpc) return;
        if (!editingEvent) {
          setTitle('');
          setDescription('');
          setEndsAt('');
          setTargets([]);
        }
        await onSaved();
        if (active.current && getTRPCClient() === trpc)
          toast.success(editingEvent ? t('updated') : t('created'));
      } catch (error) {
        const fallback = editingEvent ? t('failedUpdate') : t('failedCreate');
        if (active.current) toast.error(getTrpcError(error, fallback));
      } finally {
        busy.current = false;
        if (active.current) setSubmitting(false);
      }
    }, [
      title,
      description,
      startsAt,
      endsAt,
      targets,
      editingEvent,
      onSaved,
      t
    ]);

    let submitLabel = editingEvent ? t('save') : t('create');

    if (submitting) {
      submitLabel = editingEvent ? t('saving') : t('creating');
    }
    return (
      <Card className="h-fit rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {editingEvent ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {editingEvent ? t('editTitle') : t('create')}
          </CardTitle>
          <CardDescription>{t('timezone')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calendar-title">{t('title')}</Label>
            <Input
              id="calendar-title"
              value={title}
              onChange={changeTitle}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calendar-description">{t('description')}</Label>
            <Textarea
              id="calendar-description"
              value={description}
              onChange={changeDescription}
              maxLength={2000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calendar-start">{t('starts')}</Label>
            <Input
              id="calendar-start"
              type="datetime-local"
              value={startsAt}
              onChange={changeStart}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calendar-end">{t('ends')}</Label>
            <Input
              id="calendar-end"
              type="datetime-local"
              value={endsAt}
              onChange={changeEnd}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('invite')}
            </Label>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
              {invitableUsers.map((user) => (
                <InviteTarget
                  key={`user:${user.id}`}
                  id={user.id}
                  type="user"
                  name={user.name}
                  checked={selectedTargets.has(`user:${user.id}`)}
                  onToggle={toggleTarget}
                />
              ))}
              {roles.map((role) => (
                <InviteTarget
                  key={`role:${role.id}`}
                  id={role.id}
                  type="role"
                  name={`@${role.name}`}
                  checked={selectedTargets.has(`role:${role.id}`)}
                  onToggle={toggleTarget}
                />
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            disabled={submitting}
            onClick={saveEvent}
            data-testid={TestId.CALENDAR_FORM_SUBMIT}
          >
            {submitLabel}
          </Button>
          {editingEvent && (
            <Button
              className="w-full"
              variant="ghost"
              disabled={submitting}
              onClick={onCancelEdit}
            >
              {t('cancelEdit')}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
);
export { EventForm };
