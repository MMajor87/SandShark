import { t } from '../utils/trpc';
import { botsRouter } from './bots';
import { calendarRouter } from './calendar';
import { categoriesRouter } from './categories';
import { channelsRouter } from './channels';
import { dmsRouter } from './dms';
import { emojisRouter } from './emojis';
import { filesRouter } from './files';
import { invitesRouter } from './invites';
import { messagesRouter } from './messages';
import { othersRouter } from './others';
import { pluginsRouter } from './plugins';
import { rolesRouter } from './roles';
import { soundboardRouter } from './soundboard';
import { threadsRouter } from './threads';
import { usersRouter } from './users';
import { voiceRouter } from './voice';

const appRouter = t.router({
  others: othersRouter,
  messages: messagesRouter,
  threads: threadsRouter,
  users: usersRouter,
  channels: channelsRouter,
  dms: dmsRouter,
  files: filesRouter,
  emojis: emojisRouter,
  soundboard: soundboardRouter,
  roles: rolesRouter,
  invites: invitesRouter,
  voice: voiceRouter,
  categories: categoriesRouter,
  bots: botsRouter,
  calendar: calendarRouter,
  plugins: pluginsRouter
});

type AppRouter = typeof appRouter;

export { appRouter };
export type { AppRouter };
