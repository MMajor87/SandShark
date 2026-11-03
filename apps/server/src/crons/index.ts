import { CronJob } from 'cron';
import { cleanupBotInteractions } from '../helpers/bot-interactions';
import { logger } from '../logger';
import { cleanupFiles } from './cleanup-files';

enum CRON_TIMES {
  EVERY_15_MINUTES = '*/15 * * * *'
}

const loadCrons = () => {
  logger.debug('Loading crons...');

  new CronJob(
    CRON_TIMES.EVERY_15_MINUTES,
    cleanupFiles,
    null,
    true,
    'Europe/Lisbon',
    null,
    true
  );

  // interaction tokens last fifteen minutes, after which their rows serve nothing
  new CronJob(
    CRON_TIMES.EVERY_15_MINUTES,
    cleanupBotInteractions,
    null,
    true,
    'Europe/Lisbon',
    null,
    true
  );
};

export { loadCrons };
