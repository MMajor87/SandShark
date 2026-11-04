import { eq } from 'drizzle-orm';
import { db } from '..';
import { hostedBots } from '../schema';

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

export { getEnabledHostedBotIds, getHostedBot };
