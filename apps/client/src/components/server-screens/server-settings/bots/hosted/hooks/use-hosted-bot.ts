import { getTRPCClient } from '@/lib/trpc';
import type { THostedBot } from '@sandshark/shared';
import { useCallback, useEffect, useState } from 'react';

// the hosted bot as the server sees it, fetched again whenever its status changes, which
// also brings the compatibility report and the code source up to date
export const useHostedBot = (botId: number) => {
  const [hosted, setHosted] = useState<THostedBot | undefined>(undefined);

  const fetchHosted = useCallback(async () => {
    try {
      const trpc = getTRPCClient();
      const result = await trpc.bots.getHosted.query({ botId });

      setHosted(result);
    } catch (error) {
      console.error('Failed to load the hosted bot:', error);
    }
  }, [botId]);

  useEffect(() => {
    fetchHosted();
  }, [fetchHosted]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const trpc = getTRPCClient();
      const subscription = trpc.bots.onHostedBotUpdate.subscribe(undefined, {
        onData: (state) => {
          if (state.botId !== botId) return;

          setHosted((previous) =>
            previous ? { ...previous, ...state } : previous
          );
          fetchHosted();
        },
        onError: (error) =>
          console.error('onHostedBotUpdate subscription error:', error)
      });

      unsubscribe = () => subscription.unsubscribe();
    } catch (error) {
      console.error('Failed to follow the hosted bot:', error);
    }

    return () => unsubscribe?.();
  }, [botId, fetchHosted]);

  return { hosted, refetch: fetchHosted };
};
