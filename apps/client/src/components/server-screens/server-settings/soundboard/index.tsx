import { SettingsListEditor } from '@/components/server-screens/settings-shell/list-editor';
import { useSoundboardSounds } from '@/features/server/soundboard/hooks';
import { uploadFiles } from '@/helpers/upload-file';
import { useFilePicker } from '@/hooks/use-file-picker';
import { getTRPCClient } from '@/lib/trpc';
import {
  getTrpcError,
  SOUNDBOARD_ALLOWED_EXTENSIONS,
  SOUNDBOARD_MAX_DURATION_SECONDS,
  SOUNDBOARD_MAX_FILE_SIZE
} from '@sandshark/shared';
import { Button, Spinner } from '@sandshark/ui';
import { AudioLines, Upload } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getAudioDuration, getSoundNameFromFile } from './helpers';
import { SoundList } from './sound-list';
import { UpdateSound } from './update-sound';

const Soundboard = memo(() => {
  const { t } = useTranslation('settings');
  const sounds = useSoundboardSounds();
  const openFilePicker = useFilePicker();
  const [selectedSoundId, setSelectedSoundId] = useState<number | undefined>(
    undefined
  );
  const [isUploading, setIsUploading] = useState(false);

  const checkSoundFile = useCallback(
    async (file: File) => {
      if (file.size > SOUNDBOARD_MAX_FILE_SIZE) {
        toast.error(t('soundTooLarge', { name: file.name }));
        return false;
      }

      try {
        const duration = await getAudioDuration(file);

        if (duration > SOUNDBOARD_MAX_DURATION_SECONDS) {
          toast.error(
            t('soundTooLong', {
              name: file.name,
              seconds: SOUNDBOARD_MAX_DURATION_SECONDS
            })
          );
          return false;
        }
      } catch {
        toast.error(t('soundUnreadable', { name: file.name }));
        return false;
      }

      return true;
    },
    [t]
  );

  const uploadSounds = useCallback(async () => {
    const picked = await openFilePicker(
      SOUNDBOARD_ALLOWED_EXTENSIONS.join(','),
      true
    );

    if (!picked || picked.length === 0) return;

    setIsUploading(true);

    try {
      const checks = await Promise.all(picked.map(checkSoundFile));
      const files = picked.filter((_, index) => checks[index]);

      if (files.length === 0) return;

      const temporaryFiles = await uploadFiles(files);
      const trpc = getTRPCClient();

      for (const temporaryFile of temporaryFiles) {
        await trpc.soundboard.add.mutate({
          fileId: temporaryFile.id,
          name: getSoundNameFromFile(temporaryFile.originalName),
          emoji: null
        });
      }

      toast.success(t('soundsAdded'));
    } catch (error) {
      toast.error(getTrpcError(error, t('failedUploadSound')));
    } finally {
      setIsUploading(false);
    }
  }, [openFilePicker, checkSoundFile, t]);

  const selectedSound = useMemo(
    () => sounds.find((sound) => sound.id === selectedSoundId),
    [sounds, selectedSoundId]
  );

  return (
    <SettingsListEditor
      emptyIcon={AudioLines}
      emptyTitle={t('uploadSoundTitle')}
      emptyDescription={t('uploadSoundDesc', {
        size: SOUNDBOARD_MAX_FILE_SIZE / (1024 * 1024),
        seconds: SOUNDBOARD_MAX_DURATION_SECONDS
      })}
      emptyAction={
        <Button onClick={uploadSounds} disabled={isUploading}>
          {isUploading ? (
            <Spinner size="xxs" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {t('uploadSoundBtn')}
        </Button>
      }
      list={
        <SoundList
          sounds={sounds}
          selectedSoundId={selectedSoundId}
          setSelectedSoundId={setSelectedSoundId}
          uploadSounds={uploadSounds}
          isUploading={isUploading}
        />
      }
      editor={
        selectedSound && (
          <UpdateSound
            key={selectedSound.id}
            sound={selectedSound}
            setSelectedSoundId={setSelectedSoundId}
          />
        )
      }
    />
  );
});

export { Soundboard };
