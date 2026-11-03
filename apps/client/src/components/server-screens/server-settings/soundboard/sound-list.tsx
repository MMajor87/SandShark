import { Emoji } from '@/components/emoji';
import { SettingsSection } from '@/components/server-screens/settings-shell/section';
import { useCustomEmojiFile } from '@/features/server/emojis/hooks';
import { cn } from '@/lib/utils';
import {
  SOUNDBOARD_DEFAULT_EMOJI,
  SOUNDBOARD_MAX_SOUNDS,
  type TJoinedSoundboardSound
} from '@sandshark/shared';
import { IconButton, Spinner, Tooltip } from '@sandshark/ui';
import { Plus } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type TSoundRowProps = {
  sound: TJoinedSoundboardSound;
  isSelected: boolean;
  onSelect: (soundId: number) => void;
};

const SoundRow = memo(({ sound, isSelected, onSelect }: TSoundRowProps) => {
  const emoji = sound.emoji ?? SOUNDBOARD_DEFAULT_EMOJI;
  const customEmojiFile = useCustomEmojiFile(emoji);

  const handleClick = useCallback(
    () => onSelect(sound.id),
    [onSelect, sound.id]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent cursor-pointer',
        isSelected && 'bg-accent ring-2 ring-primary'
      )}
    >
      <Emoji
        emoji={emoji}
        file={customEmojiFile}
        className="size-5 shrink-0"
        nativeEmojiClassName="text-lg leading-none"
      />
      <span className="truncate">{sound.name}</span>
    </button>
  );
});

SoundRow.displayName = 'SoundRow';

type TSoundListProps = {
  sounds: TJoinedSoundboardSound[];
  selectedSoundId: number | undefined;
  setSelectedSoundId: (soundId: number) => void;
  uploadSounds: () => void;
  isUploading: boolean;
};

const SoundList = memo(
  ({
    sounds,
    selectedSoundId,
    setSelectedSoundId,
    uploadSounds,
    isUploading
  }: TSoundListProps) => {
    const { t } = useTranslation('settings');
    const isFull = sounds.length >= SOUNDBOARD_MAX_SOUNDS;

    let uploadAction = (
      <Tooltip content={t('uploadSoundBtn')}>
        <IconButton
          icon={Plus}
          size="sm"
          variant="ghost"
          onClick={uploadSounds}
          disabled={isFull}
        />
      </Tooltip>
    );

    if (isUploading) {
      uploadAction = <Spinner size="xxs" />;
    }

    return (
      <SettingsSection
        title={t('soundboardTitle')}
        description={t('soundboardCount', {
          count: sounds.length,
          max: SOUNDBOARD_MAX_SOUNDS
        })}
        action={uploadAction}
      >
        <div className="max-h-96 overflow-y-auto">
          {sounds.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('noSoundsYet')}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {sounds.map((sound) => (
                <SoundRow
                  key={sound.id}
                  sound={sound}
                  isSelected={selectedSoundId === sound.id}
                  onSelect={setSelectedSoundId}
                />
              ))}
            </div>
          )}
        </div>
      </SettingsSection>
    );
  }
);

SoundList.displayName = 'SoundList';

export { SoundList };
