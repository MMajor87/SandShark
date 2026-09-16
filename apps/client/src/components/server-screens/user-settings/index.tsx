import { PluginSlotRenderer } from '@/components/plugin-slot-renderer';
import { useCan, useUserSettingsPlugins } from '@/features/server/hooks';
import { isDesktopClient } from '@/platform/environment';
import { Permission, PluginSlot } from '@sharkord/shared';
import {
  Bell,
  Headphones,
  KeyRound,
  Package,
  SlidersHorizontal,
  User
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TServerScreenBaseProps } from '../screens';
import { SettingsShell } from '../settings-shell';
import type { TSettingsEntry } from '../settings-shell/types';
import { Desktop } from './desktop';
import { Devices } from './devices';
import { Notifications } from './notifications';
import { Others } from './others';
import { Password } from './password';
import { Profile } from './profile';

type TUserSettingsProps = TServerScreenBaseProps;

const UserSettings = memo(({ close }: TUserSettingsProps) => {
  const { t } = useTranslation('settings');
  const can = useCan();
  const userSettingsPlugins = useUserSettingsPlugins();

  const entries = useMemo<TSettingsEntry[]>(
    () => [
      {
        id: 'profile',
        label: t('profileTab'),
        icon: User,
        content: <Profile />
      },
      {
        id: 'devices',
        label: t('devicesTab'),
        icon: Headphones,
        content: <Devices />
      },
      {
        id: 'password',
        label: t('passwordTab'),
        icon: KeyRound,
        content: <Password />
      },
      {
        id: 'notifications',
        label: t('notificationsTab'),
        icon: Bell,
        content: <Notifications />
      },
      {
        id: 'others',
        label: t('othersTab'),
        icon: SlidersHorizontal,
        content: <Others />
      },
      ...(isDesktopClient() && window.sandSharkDesktop
        ? [
            {
              id: 'desktop',
              label: t('desktopTab'),
              icon: SlidersHorizontal,
              content: <Desktop />
            }
          ]
        : [])
    ],
    [t]
  );

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
