import { getBotCommandMenu } from '../../helpers/bot-command-menu';
import { protectedProcedure } from '../../utils/trpc';

// the composer's bot commands, refetched whenever a bot changes its commands
const getCommandsRoute = protectedProcedure.query(async ({ ctx }) =>
  getBotCommandMenu(ctx.user.id)
);

export { getCommandsRoute };
