import { PluginSlotRenderer } from '@/components/plugin-slot-renderer';
import { useCan, useUserSettingsPlugins } from '@/features/server/hooks';
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
    // its group where it is not clicked by accident. the app group puts voice first, since the
    // desktop app is mostly used in calls. the desktop entry is there in the browser too, where
    // it says what the app adds
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
        id: 'devices',
        label: t('devicesTab'),
        icon: Headphones,
        group: app,
        content: <Devices />
      },
      {
        id: 'notifications',
        label: t('notificationsTab'),
        icon: Bell,
        group: app,
        content: <Notifications />
      },
      {
        id: 'hotkeys',
        label: t('hotkeysTab'),
        icon: Keyboard,
        group: app,
        content: <Hotkeys />
      },
      {
        id: 'appearance',
        label: t('appearanceTab'),
        icon: Palette,
        group: app,
        content: <Appearance />
      },
      {
        id: 'desktop',
        label: t('desktopAppTab'),
        icon: Monitor,
        group: app,
        content: <Desktop />
      },
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
