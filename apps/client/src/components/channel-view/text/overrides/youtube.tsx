import { memo } from 'react';
import { OverrideLayout } from './layout';
import { VideoPlayer } from './video-player';

const DESKTOP_YOUTUBE_REFERRER = 'https://sandshark.localhost/';

type TYoutubeOverrideProps = {
  videoId: string;
};

const YoutubeOverride = memo(({ videoId }: TYoutubeOverrideProps) => {
  const origin =
    window.location.protocol === 'http:' ||
    window.location.protocol === 'https:'
      ? window.location.origin
      : DESKTOP_YOUTUBE_REFERRER.slice(0, -1);

  const widgetReferrer =
    window.location.protocol === 'http:' ||
    window.location.protocol === 'https:'
      ? window.location.href
      : DESKTOP_YOUTUBE_REFERRER;

  return (
    <OverrideLayout>
      <VideoPlayer
        url={`https://www.youtube.com/watch?v=${videoId}`}
        config={{
          youtube: {
            origin,
            widget_referrer: widgetReferrer,
            referrerpolicy: 'strict-origin-when-cross-origin'
          }
        }}
      />
    </OverrideLayout>
  );
});

export { YoutubeOverride };
