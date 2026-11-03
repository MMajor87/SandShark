import { t } from '../../utils/trpc';
import { createBotRoute } from './create-bot';
import { deleteBotRoute } from './delete-bot';
import { getBotsRoute } from './get-bots';
import { renameBotRoute } from './rename-bot';
import { resetBotTokenRoute } from './reset-bot-token';

const botsRouter = t.router({
  getAll: getBotsRoute,
  create: createBotRoute,
  rename: renameBotRoute,
  resetToken: resetBotTokenRoute,
  delete: deleteBotRoute
});

export { botsRouter };
