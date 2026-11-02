import {
  beginServerConnection,
  openServerProfiles
} from '@/features/app/actions';
import { switchServer } from '@/features/server/actions';
import { useInfo } from '@/features/server/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import {
  getActiveServerProfileId,
  getServerProfiles,
  selectServerProfile
} from '@/helpers/server-connection';
import { cn } from '@/lib/utils';
import { Tooltip } from '@sharkord/ui';
import { Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type TServerRailIconProps = {
  icon: string | undefined;
  name: string;
};

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).slice(0, 2);

  return words.map((word) => word.charAt(0).toUpperCase()).join('');
};

const ServerRailIcon = memo(({ icon, name }: TServerRailIconProps) => {
  const [failedToLoad, setFailedToLoad] = useState(false);

  useEffect(() => {
    setFailedToLoad(false);
  }, [icon]);

  const onError = useCallback(() => setFailedToLoad(true), []);

  if (!icon || failedToLoad) {
    return <span className="text-sm font-semibold">{getInitials(name)}</span>;
  }

  return (
    <img
      src={icon}
      alt=""
      className="size-full object-cover"
      onError={onError}
    />
  );
});

type TServerRailItemProps = {
  profileId: string;
  name: string;
  icon: string | undefined;
  isActive: boolean;
  onSelect: (profileId: string) => void;
};

const ServerRailItem = memo(
  ({ profileId, name, icon, isActive, onSelect }: TServerRailItemProps) => {
    const onClick = useCallback(
      () => onSelect(profileId),
      [onSelect, profileId]
    );

    return (
      <Tooltip content={name} side="right" sideOffset={12}>
        <button
          type="button"
          aria-label={name}
          aria-current={isActive ? 'page' : undefined}
          onClick={onClick}
          className="group relative flex size-12 shrink-0 items-center justify-center focus-visible:outline-none"
        >
          <span
            className={cn(
              'absolute -left-3 w-1 rounded-r-full bg-foreground transition-all duration-200',
              isActive ? 'h-10' : 'h-0 group-hover:h-5'
            )}
          />
          <span
            className={cn(
              'flex size-12 items-center justify-center overflow-hidden bg-background text-foreground transition-all duration-200 group-focus-visible:ring-2 group-focus-visible:ring-ring',
              isActive
                ? 'rounded-2xl'
                : 'rounded-3xl group-hover:rounded-2xl group-hover:bg-accent'
            )}
          >
            <ServerRailIcon icon={icon} name={name} />
          </span>
        </button>
      </Tooltip>
    );
  }
);

const ServerRail = memo(() => {
  const { t } = useTranslation('sidebar');
  const info = useInfo();
  const [profiles] = useState(() => getServerProfiles());
  const [activeProfileId] = useState(() => getActiveServerProfileId());
  const activeLogo = info?.logo ? getFileUrl(info.logo) : undefined;

  const onSelect = useCallback((profileId: string) => {
    if (profileId === getActiveServerProfileId()) return;
    if (!selectServerProfile(profileId)) return;

    switchServer();
    beginServerConnection();
  }, []);

  return (
    <nav
      aria-label={t('servers')}
      className="hidden w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-rail py-3 md:flex"
    >
      {profiles.map((profile) => {
        const isActive = profile.id === activeProfileId;

        return (
          <ServerRailItem
            key={profile.id}
            profileId={profile.id}
            name={profile.displayName ?? profile.httpUrl}
            icon={isActive ? (activeLogo ?? profile.icon) : profile.icon}
            isActive={isActive}
            onSelect={onSelect}
          />
        );
      })}
      <div className="mx-auto h-0.5 w-8 shrink-0 rounded-full bg-border" />
      <Tooltip content={t('addServer')} side="right" sideOffset={12}>
        <button
          type="button"
          aria-label={t('addServer')}
          onClick={openServerProfiles}
          className="flex size-12 shrink-0 items-center justify-center rounded-3xl bg-background text-emerald-500 transition-all duration-200 hover:rounded-2xl hover:bg-emerald-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-5" />
        </button>
      </Tooltip>
    </nav>
  );
});

export { ServerRail };
