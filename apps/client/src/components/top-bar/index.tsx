import {
  useCurrentVoiceChannelId,
  useIsCurrentVoiceChannelSelected
} from '@/features/server/channels/hooks';
import { usePublicServerSettings } from '@/features/server/hooks';
import { cn } from '@/lib/utils';
import { PluginSlot } from '@sandshark/shared';
import { Button, Tooltip } from '@sandshark/ui';
import { Users } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PluginSlotRenderer } from '../plugin-slot-renderer';
import { ServerSearch } from './server-search';
import { VoiceButtons } from './voice-buttons';

type THeaderActionsProps = {
  onToggleMembers: () => void;
  isMembersOpen: boolean;
};

const HeaderActions = memo(
  ({ onToggleMembers, isMembersOpen }: THeaderActionsProps) => {
    const { t } = useTranslation('topbar');
    const isCurrentVoiceChannelSelected = useIsCurrentVoiceChannelSelected();
    const currentVoiceChannelId = useCurrentVoiceChannelId();
    const settings = usePublicServerSettings();
    const membersLabel = isMembersOpen
      ? t('closeMembersSidebar')
      : t('openMembersSidebar');

    return (
      <div className="hidden shrink-0 items-center gap-1 md:flex">
        <PluginSlotRenderer slotId={PluginSlot.TOPBAR_RIGHT} />
        {isCurrentVoiceChannelSelected && currentVoiceChannelId && (
          <VoiceButtons currentVoiceChannelId={currentVoiceChannelId} />
        )}
        <Tooltip content={membersLabel}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMembers}
            aria-label={membersLabel}
            aria-pressed={isMembersOpen}
            className={cn(
              'size-8 text-muted-foreground hover:text-foreground',
              isMembersOpen && 'text-foreground'
            )}
          >
            <Users className="size-5" />
          </Button>
        </Tooltip>
        {settings?.enableSearch && <ServerSearch />}
      </div>
    );
  }
);

export { HeaderActions };
