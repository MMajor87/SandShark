import { cn } from '@sharkord/ui';
import { memo, type ComponentProps } from 'react';
import ReactPlayer from 'react-player';

type TVideoPlayerProps = {
  url: string;
  className?: string;
  config?: ComponentProps<typeof ReactPlayer>['config'];
};

const VideoPlayer = memo(({ url, className, config }: TVideoPlayerProps) => {
  return (
    <div className={cn('aspect-video w-150 max-w-full', className)}>
      <ReactPlayer
        src={url}
        config={config}
        controls
        width="100%"
        height="100%"
        style={{
          colorScheme: 'dark'
        }}
      />
    </div>
  );
});

export { VideoPlayer };
