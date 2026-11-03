import { Emoji } from '@/components/emoji';
import { useCustomEmojiFile } from '@/features/server/emojis/hooks';
import { useSoundboardSounds } from '@/features/server/soundboard/hooks';
import { getTRPCClient } from '@/lib/trpc';
import {
  getTrpcError,
  SOUNDBOARD_DEFAULT_EMOJI,
  type TJoinedSoundboardSound
} from '@sandshark/shared';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip
} from '@sandshark/ui';
import { AudioLines } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TSoundOptionProps = {
  sound: TJoinedSoundboardSound;
  onPlay: (soundId: number) => void;
};

const SoundOption = memo(({ sound, onPlay }: TSoundOptionProps) => {
  const emoji = sound.emoji ?? SOUNDBOARD_DEFAULT_EMOJI;
  const customEmojiFile = useCustomEmojiFile(emoji);

  const handleClick = useCallback(() => onPlay(sound.id), [onPlay, sound.id]);

  return (
    <button
      type="button"
      className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent cursor-pointer"
      onClick={handleClick}
      title={sound.name}
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

SoundOption.displayName = 'SoundOption';

const SoundboardButton = memo(() => {
  const { t } = useTranslation('common');
  const sounds = useSoundboardSounds();
  const [open, setOpen] = useState(false);

  const playSound = useCallback(
    async (soundId: number) => {
      try {
        const trpc = getTRPCClient();

        await trpc.soundboard.play.mutate({ soundId });
      } catch (error) {
        toast.error(getTrpcError(error, t('failedPlaySound')));
      }
    },
    [t]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={t('soundboard')}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded size-8 transition-all duration-200 hover:bg-muted/60"
            aria-label={t('soundboard')}
          >
            <AudioLines className="size-4" />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-72 p-2" align="center" sideOffset={12}>
        {sounds.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t('soundboardEmpty')}
          </p>
        ) : (
          <div className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto">
            {sounds.map((sound) => (
              <SoundOption key={sound.id} sound={sound} onPlay={playSound} />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});

SoundboardButton.displayName = 'SoundboardButton';

export { SoundboardButton };
