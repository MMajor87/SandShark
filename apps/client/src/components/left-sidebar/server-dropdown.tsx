import {
  beginServerConnection,
  openServerProfiles
} from '@/features/app/actions';
import { openDialog, requestConfirmation } from '@/features/dialogs/actions';
import { openServerScreen } from '@/features/server-screens/actions';
import { disconnectFromServer, switchServer } from '@/features/server/actions';
import {
  getActiveServerProfileId,
  getServerProfiles,
  selectServerProfile,
  type TServerProfile
} from '@/helpers/server-connection';
import { Permission } from '@sharkord/shared';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@sharkord/ui';
import { Check, ChevronDown, Menu, Server } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../dialogs/dialogs';
import { Protect } from '../protect';
import { ServerScreen } from '../server-screens/screens';

type TServerSwitcherProps = {
  serverName: string | undefined;
  'data-testid'?: string;
};

const ServerSwitcher = memo(
  ({ serverName, 'data-testid': testId }: TServerSwitcherProps) => {
    const [open, setOpen] = useState(false);
    const [profiles, setProfiles] = useState<TServerProfile[]>(() =>
      getServerProfiles()
    );
    const [activeProfileId, setActiveProfileId] = useState(() =>
      getActiveServerProfileId()
    );

    const handleOpenChange = useCallback((nextOpen: boolean) => {
      if (nextOpen) {
        setProfiles(getServerProfiles());
        setActiveProfileId(getActiveServerProfileId());
      }

      setOpen(nextOpen);
    }, []);

    const switchProfile = useCallback((profileId: string) => {
      if (profileId === getActiveServerProfileId()) {
        setOpen(false);
        return;
      }

      if (!selectServerProfile(profileId)) return;

      switchServer();
      beginServerConnection();
      setOpen(false);
    }, []);

    const manageServers = useCallback(() => {
      setOpen(false);
      openServerProfiles();
    }, []);

    return (
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="min-w-0 flex-1 justify-start gap-1 px-0 font-semibold"
            title="Switch server"
            data-testid={testId}
          >
            <span className="truncate">{serverName ?? 'SandShark'}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Servers</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId;
            const name = profile.displayName ?? profile.httpUrl;

            return (
              <DropdownMenuItem
                key={profile.id}
                onClick={() => switchProfile(profile.id)}
                className="flex items-center gap-2"
              >
                {profile.icon ? (
                  <img src={profile.icon} alt="" className="h-5 w-5 rounded" />
                ) : (
                  <Server className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {isActive && <Check className="h-4 w-4 shrink-0" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={manageServers}>
            Manage servers
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

const ServerDropdownMenu = memo(() => {
  const { t } = useTranslation('sidebar');
  const serverSettingsPermissions = useMemo(
    () => [
      Permission.MANAGE_SETTINGS,
      Permission.MANAGE_ROLES,
      Permission.MANAGE_EMOJIS,
      Permission.MANAGE_STORAGE,
      Permission.MANAGE_USERS,
      Permission.MANAGE_INVITES,
      Permission.MANAGE_UPDATES
    ],
    []
  );

  const handleDisconnectClick = useCallback(async () => {
    const confirmed = await requestConfirmation({
      title: t('disconnectConfirmTitle'),
      message: t('disconnectConfirmMsg'),
      confirmLabel: t('disconnect')
    });

    if (confirmed) {
      disconnectFromServer();
    }
  }, [t]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{t('server')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Protect permission={Permission.MANAGE_CATEGORIES}>
          <DropdownMenuItem onClick={() => openDialog(Dialog.CREATE_CATEGORY)}>
            {t('addCategory')}
          </DropdownMenuItem>
        </Protect>
        <Protect permission={serverSettingsPermissions}>
          <DropdownMenuItem
            onClick={() => openServerScreen(ServerScreen.SERVER_SETTINGS)}
          >
            {t('serverSettings')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </Protect>
        <DropdownMenuItem onClick={openServerProfiles}>
          Switch server
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDisconnectClick}
          className="text-destructive focus:text-destructive"
        >
          {t('disconnect')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export { ServerDropdownMenu, ServerSwitcher };
