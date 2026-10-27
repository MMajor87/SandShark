import { t } from '../../utils/trpc';
import { createEventRoute } from './create-event';
import { deleteEventRoute } from './delete-event';
import { getEventsRoute } from './get-events';

const calendarRouter = t.router({
  getAll: getEventsRoute,
  create: createEventRoute,
  delete: deleteEventRoute
});
export { calendarRouter };
