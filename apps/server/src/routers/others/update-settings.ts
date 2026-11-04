import {
  ActivityLogType,
  Permission,
  STORAGE_MAX_FILES_PER_MESSAGE,
  STORAGE_MAX_IMAGE_OPTIMIZATION_QUALITY,
  STORAGE_MIN_IMAGE_OPTIMIZATION_QUALITY,
  StorageOverflowAction
} from '@sandshark/shared';
import { z } from 'zod';
import { updateSettings } from '../../db/mutations/server';
import { publishSettings } from '../../db/publishers';
import { getSettings } from '../../db/queries/server';
import { startEnabledHostedBots } from '../../helpers/hosted-bots';
import { pluginManager } from '../../plugins';
import { enqueueActivityLog } from '../../queues/activity-log';
import { HostedBotRuntime } from '../../runtimes/hosted-bot';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const zStorageSettings = z.object({
  storageUploadEnabled: z.boolean().optional(),
  storageFileSharingInDirectMessages: z.boolean().optional(),
  storageQuota: z.number().min(0).optional(),
  storageUploadMaxFileSize: z.number().min(0).optional(),
  storageMaxAvatarSize: z.number().min(0).optional(),
  storageMaxBannerSize: z.number().min(0).optional(),
  storageMaxFilesPerMessage: z
    .number()
    .int()
    .min(0)
    .max(STORAGE_MAX_FILES_PER_MESSAGE)
    .optional(),
  storageSpaceQuotaByUser: z.number().min(0).optional(),
  storageOverflowAction: z.enum(StorageOverflowAction).optional(),
  storageSignedUrlsEnabled: z.boolean().optional(),
  storageSignedUrlsTtlSeconds: z.number().int().min(0).optional(),
  storageImageOptimizationEnabled: z.boolean().optional(),
  storageImageOptimizationQuality: z
    .number()
    .int()
    .min(STORAGE_MIN_IMAGE_OPTIMIZATION_QUALITY)
    .max(STORAGE_MAX_IMAGE_OPTIMIZATION_QUALITY)
    .optional()
});

const zGeneralSettings = z.object({
  name: z.string().min(2).max(24).optional(),
  description: z.string().max(128).optional(),
  password: z.string().min(1).max(32).optional().nullable(),
  onlyAskForPasswordOnFirstJoin: z.boolean().optional(),
  allowNewUsers: z.boolean().optional(),
  directMessagesEnabled: z.boolean().optional(),
  enablePlugins: z.boolean().optional(),
  enableBotHosting: z.boolean().optional(),
  webRtcSimulcastEnabled: z.boolean().optional(),
  enableSearch: z.boolean().optional(),
  showWelcomeDialog: z.boolean().optional()
});

const STORAGE_SETTING_KEYS = Object.keys(zStorageSettings.shape);
const GENERAL_SETTING_KEYS = Object.keys(zGeneralSettings.shape);

const updateSettingsRoute = protectedProcedure
  .input(
    z.object({
      ...zGeneralSettings.shape,
      ...zStorageSettings.shape
    })
  )
  .mutation(async ({ input, ctx }) => {
    invariant(Object.keys(input).length > 0, {
      code: 'BAD_REQUEST',
      message: 'Nothing to update.'
    });

    const touchesStorage = STORAGE_SETTING_KEYS.some((key) => key in input);
    const touchesGeneral = GENERAL_SETTING_KEYS.some((key) => key in input);

    if (touchesStorage) {
      await ctx.needsPermission(Permission.MANAGE_STORAGE);
    }

    if (touchesGeneral) {
      await ctx.needsPermission(Permission.MANAGE_SETTINGS);
    }

    // turning hosting on lets uploaded code run, which managing settings alone does not grant
    if (input.enableBotHosting !== undefined) {
      await ctx.needsPermission(Permission.HOST_BOTS);
    }

    const { enablePlugins: oldEnablePlugins, enableBotHosting: oldBotHosting } =
      await getSettings();

    await updateSettings(input);

    if (
      input.enablePlugins !== undefined &&
      input.enablePlugins !== oldEnablePlugins
    ) {
      if (input.enablePlugins) {
        await pluginManager.loadPlugins();
      } else {
        await pluginManager.unloadPlugins();
      }

      // connected clients would otherwise keep rendering slots and commands of
      // plugins that are no longer running
      pluginManager.publishPlugins();
    }

    if (
      input.enableBotHosting !== undefined &&
      input.enableBotHosting !== oldBotHosting
    ) {
      if (input.enableBotHosting) {
        await startEnabledHostedBots();
      } else {
        await HostedBotRuntime.stopAll();
      }
    }

    publishSettings();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...loggedValues } = input;

    enqueueActivityLog({
      type: ActivityLogType.EDIT_SERVER_SETTINGS,
      userId: ctx.userId,
      details: { values: loggedValues }
    });
  });

export { updateSettingsRoute };
