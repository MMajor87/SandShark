import { getTRPCClient } from '@/lib/trpc';
import type { THostedBotLogEntry } from '@sandshark/shared';
import { useEffect, useState } from 'react';

// the server keeps this many lines, so the page never holds more than it would get back
const MAX_LINES = 2000;

export const useHostedBotLogs = (botId: number) => {
  const [logs, setLogs] = useState<THostedBotLogEntry[]>([]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    // the panel can close while the first lines are still loading
    let closed = false;

    const setup = async () => {
      try {
        const trpc = getTRPCClient();
        const initial = await trpc.bots.getHostedLogs.query({ botId });

        if (closed) return;

        setLogs(initial);

        const subscription = trpc.bots.onHostedBotLog.subscribe(undefined, {
          onData: (entry) => {
            if (entry.botId !== botId) return;

            setLogs((previous) => [...previous, entry].slice(-MAX_LINES));
          },
          onError: (error) =>
            console.error('onHostedBotLog subscription error:', error)
        });

        unsubscribe = () => subscription.unsubscribe();
      } catch (error) {
        console.error('Failed to follow the hosted bot log:', error);
      }
    };

    setup();

    return () => {
      closed = true;
      unsubscribe?.();
    };
  }, [botId]);

  return logs;
};
