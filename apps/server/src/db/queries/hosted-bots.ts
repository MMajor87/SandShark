import { eq } from 'drizzle-orm';
import { db } from '..';
import { hostedBots, users } from '../schema';

const getHostedBot = (botId: number) =>
  db
    .select({
      botId: hostedBots.botId,
      enabled: hostedBots.enabled,
      env: hostedBots.env,
      tokenEnvNames: hostedBots.tokenEnvNames,
      jsRuntime: hostedBots.jsRuntime,
      sourceType: hostedBots.sourceType,
      sourceUrl: hostedBots.sourceUrl,
      sourceRef: hostedBots.sourceRef,
      codeUpdatedAt: hostedBots.codeUpdatedAt
    })
    .from(hostedBots)
    .where(eq(hostedBots.botId, botId))
    .limit(1)
    .get();

const getEnabledHostedBotIds = async () => {
  const rows = await db
    .select({ botId: hostedBots.botId })
    .from(hostedBots)
    .where(eq(hostedBots.enabled, true))
    .all();

  return rows.map(({ botId }) => botId);
};

const getHostedBotNames = () =>
  db
    .select({ id: hostedBots.botId, name: users.name })
    .from(hostedBots)
    .innerJoin(users, eq(users.id, hostedBots.botId))
    .orderBy(users.name)
    .all();

export { getEnabledHostedBotIds, getHostedBot, getHostedBotNames };
