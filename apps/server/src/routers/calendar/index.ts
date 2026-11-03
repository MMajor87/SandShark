import { t } from '../../utils/trpc';
import { createEventRoute } from './create-event';
import { deleteEventRoute } from './delete-event';
import { getEventsRoute } from './get-events';
import { respondToEventRoute } from './respond-to-event';
import { updateEventRoute } from './update-event';

const calendarRouter = t.router({
  getAll: getEventsRoute,
  create: createEventRoute,
  update: updateEventRoute,
  respond: respondToEventRoute,
  delete: deleteEventRoute
});
export { calendarRouter };
