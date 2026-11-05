import { PluginSlotRenderer } from '@/components/plugin-slot-renderer';
import { useCan, useUserSettingsPlugins } from '@/features/server/hooks';
import { isDesktopClient } from '@/platform/environment';
import { Permission, PluginSlot } from '@sandshark/shared';
import {
  Bell,
  Headphones,
  Keyboard,
  KeyRound,
  Monitor,
  Package,
  Palette,
  SlidersHorizontal,
  Trash2,
  User
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TServerScreenBaseProps } from '../screens';
import { SettingsShell } from '../settings-shell';
import type { TSettingsEntry } from '../settings-shell/types';
import { Appearance } from './appearance';
import { DeleteAccount } from './delete-account';
import { Desktop } from './desktop';
import { Devices } from './devices';
import { Hotkeys } from './hotkeys';
import { Notifications } from './notifications';
import { Others } from './others';
import { Password } from './password';
import { Profile } from './profile';

type TUserSettingsProps = TServerScreenBaseProps;

const UserSettings = memo(({ close }: TUserSettingsProps) => {
  const { t } = useTranslation('settings');
  const can = useCan();
  const userSettingsPlugins = useUserSettingsPlugins();

  const entries = useMemo<TSettingsEntry[]>(() => {
    const account = t('settingsGroupAccount');
    const app = t('settingsGroupApp');

    // the account comes first and ends with deleting it, the riskiest entry, at the bottom of
    // its group where it is not clicked by accident
    return [
      {
        id: 'profile',
        label: t('profileTab'),
        icon: User,
        group: account,
        content: <Profile />
      },
      {
        id: 'password',
        label: t('passwordTab'),
        icon: KeyRound,
        group: account,
        content: <Password />
      },
      {
        id: 'delete-account',
        label: t('deleteAccountTab'),
        icon: Trash2,
        group: account,
        tone: 'danger' as const,
        content: <DeleteAccount />
      },
      {
        id: 'appearance',
        label: t('appearanceTab'),
        icon: Palette,
        group: app,
        content: <Appearance />
      },
      {
        id: 'notifications',
        label: t('notificationsTab'),
        icon: Bell,
        group: app,
        content: <Notifications />
      },
      {
        id: 'devices',
        label: t('devicesTab'),
        icon: Headphones,
        group: app,
        content: <Devices />
      },
      {
        id: 'hotkeys',
        label: t('hotkeysTab'),
        icon: Keyboard,
        group: app,
        content: <Hotkeys />
      },
      ...(isDesktopClient() && window.sandSharkDesktop
        ? [
            {
              id: 'desktop',
              label: t('desktopTab'),
              icon: Monitor,
              group: app,
              content: <Desktop />
            }
          ]
        : []),
      {
        id: 'others',
        label: t('othersTab'),
        icon: SlidersHorizontal,
        group: app,
        content: <Others />
      }
    ];
  }, [t]);

  // the plugin owns everything inside its entry, so this renders its slot and
  // nothing else
  const pluginEntries = useMemo<TSettingsEntry[]>(() => {
    if (!can(Permission.USE_PLUGINS)) return [];

    return userSettingsPlugins.map((plugin) => ({
      id: `plugin-${plugin.pluginId}`,
      label: plugin.name,
      icon: Package,
      logo: plugin.logo,
      content: (
        <PluginSlotRenderer
          slotId={PluginSlot.USER_SETTINGS}
          onlyPluginId={plugin.pluginId}
        />
      )
    }));
  }, [can, userSettingsPlugins]);

  return (
    <SettingsShell
      title={t('userSettingsTitle')}
      close={close}
      entries={entries}
      pluginEntries={pluginEntries}
    />
  );
});

export { UserSettings };
