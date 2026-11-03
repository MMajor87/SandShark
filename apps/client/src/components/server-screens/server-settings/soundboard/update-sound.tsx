import { Emoji } from '@/components/emoji';
import {
  EmojiPickerPanel,
  PICKER_PANEL_CONTENT_CLASS
} from '@/components/emoji-picker/picker-panel';
import { SettingsSection } from '@/components/server-screens/settings-shell/section';
import { useSettingsForm } from '@/components/server-screens/settings-shell/use-settings-form';
import type { TEmojiItem } from '@/components/tiptap-input/helpers';
import { useSoundboardVolume } from '@/features/app/hooks';
import { requestConfirmation } from '@/features/dialogs/actions';
import { useCustomEmojiFile } from '@/features/server/emojis/hooks';
import { playSoundboardFile } from '@/helpers/soundboard-player';
import { getTRPCClient } from '@/lib/trpc';
import {
  getTrpcError,
  SOUNDBOARD_DEFAULT_EMOJI,
  type TJoinedSoundboardSound
} from '@sandshark/shared';
import {
  Button,
  Group,
  IconButton,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip
} from '@sandshark/ui';
import { filesize } from 'filesize';
import { Play, Trash2, X } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TUpdateSoundProps = {
  sound: TJoinedSoundboardSound;
  setSelectedSoundId: (soundId: number | undefined) => void;
};

type TSoundValues = {
  name: string;
  emoji: string | null;
};

const UpdateSound = memo(({ sound, setSelectedSoundId }: TUpdateSoundProps) => {
  const { t } = useTranslation('settings');
  const volume = useSoundboardVolume();
  const [pickerOpen, setPickerOpen] = useState(false);

  const onSave = useCallback(
    async (values: TSoundValues) => {
      const trpc = getTRPCClient();

      await trpc.soundboard.update.mutate({
        soundId: sound.id,
        name: values.name,
        emoji: values.emoji
      });
    },
    [sound.id]
  );

  const { r, values, onChange } = useSettingsForm<TSoundValues>({
    initialValues: { name: sound.name, emoji: sound.emoji },
    onSave,
    successMessage: t('soundUpdated'),
    errorMessage: t('failedUpdateSound')
  });

  const displayedEmoji = values.emoji ?? SOUNDBOARD_DEFAULT_EMOJI;
  const customEmojiFile = useCustomEmojiFile(displayedEmoji);

  const handleEmojiSelect = useCallback(
    (emoji: TEmojiItem) => {
      onChange('emoji', emoji.shortcodes[0] ?? null);
      setPickerOpen(false);
    },
    [onChange]
  );

  const handleRemoveEmoji = useCallback(
    () => onChange('emoji', null),
    [onChange]
  );

  const handlePreview = useCallback(() => {
    playSoundboardFile(sound.file, volume).catch(console.error);
  }, [sound.file, volume]);

  const handleDelete = useCallback(async () => {
    const confirmed = await requestConfirmation({
      title: t('deleteSoundTitle'),
      message: t('deleteSoundMsg', { name: sound.name }),
      confirmLabel: t('deleteSoundBtn'),
      variant: 'danger'
    });

    if (!confirmed) return;

    try {
      const trpc = getTRPCClient();

      await trpc.soundboard.delete.mutate({ soundId: sound.id });
      toast.success(t('soundDeleted'));
      setSelectedSoundId(undefined);
    } catch (error) {
      toast.error(getTrpcError(error, t('failedDeleteSound')));
    }
  }, [sound.id, sound.name, setSelectedSoundId, t]);

  const handleClose = useCallback(
    () => setSelectedSoundId(undefined),
    [setSelectedSoundId]
  );

  return (
    <SettingsSection
      className="flex-1"
      title={t('editSoundTitle')}
      action={
        <>
          <Tooltip content={t('deleteSoundBtn')}>
            <IconButton
              icon={Trash2}
              size="sm"
              variant="destructive"
              onClick={handleDelete}
            />
          </Tooltip>
          <Tooltip content={t('closeEditorTooltip')}>
            <IconButton
              icon={X}
              size="sm"
              variant="ghost"
              onClick={handleClose}
            />
          </Tooltip>
        </>
      }
    >
      <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
        <Tooltip content={t('previewSound')}>
          <IconButton
            icon={Play}
            size="sm"
            variant="ghost"
            onClick={handlePreview}
          />
        </Tooltip>
        <div className="min-w-0">
          <div className="truncate font-medium">{sound.name}</div>
          <div className="text-sm text-muted-foreground">
            {filesize(sound.file.size)} • {t('soundUploadedBy')}{' '}
            {sound.user.name}
          </div>
        </div>
      </div>

      <Group label={t('soundNameLabel')}>
        <Input placeholder={t('soundNamePlaceholder')} {...r('name')} />
      </Group>

      <Group label={t('soundEmojiLabel')} description={t('soundEmojiDesc')}>
        <div className="flex items-center gap-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon">
                <Emoji
                  emoji={displayedEmoji}
                  file={customEmojiFile}
                  className="size-5"
                  nativeEmojiClassName="text-lg leading-none"
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className={PICKER_PANEL_CONTENT_CLASS}
              align="start"
            >
              <EmojiPickerPanel onEmojiSelect={handleEmojiSelect} />
            </PopoverContent>
          </Popover>
          {values.emoji && (
            <Button variant="ghost" size="sm" onClick={handleRemoveEmoji}>
              {t('removeSoundEmoji')}
            </Button>
          )}
        </div>
      </Group>
    </SettingsSection>
  );
});

UpdateSound.displayName = 'UpdateSound';

export { UpdateSound };
