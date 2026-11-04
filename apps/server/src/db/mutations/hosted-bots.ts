import type { HostedBotSourceType } from '@sandshark/shared';
import { db } from '..';
import { hostedBots } from '../schema';

type THostedBotPatch = Partial<{
  enabled: boolean;
  env: Record<string, string>;
  tokenEnvNames: string[];
  sourceType: HostedBotSourceType;
  sourceUrl: string | null;
  sourceRef: string | null;
  codeUpdatedAt: number;
}>;

// a bot has no hosted row until an admin first does something with its hosting
const upsertHostedBot = async (botId: number, patch: THostedBotPatch) => {
  const now = Date.now();

  await db
    .insert(hostedBots)
    .values({ botId, ...patch, createdAt: now })
    .onConflictDoUpdate({
      target: hostedBots.botId,
      set: { ...patch, updatedAt: now }
    });
};

export { upsertHostedBot };
