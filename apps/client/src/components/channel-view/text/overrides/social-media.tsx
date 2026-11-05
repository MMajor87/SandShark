import { memo, useMemo, useRef, useState } from 'react';
import { useXEmbedHeight } from '../hooks/use-x-embed-height';
import { OverrideLayout } from './layout';

// what an x post gets before its embed has reported its height, the size it always had
const X_DEFAULT_HEIGHT_PX = 552;

type TPostProps = {
  postId: string;
};

// the theme provider puts the resolved mode, light or dark, on the root element
const getEmbedTheme = () =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const XPost = memo(({ postId }: TPostProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reportedHeight = useXEmbedHeight(iframeRef);

  // read once, when the post is shown: the theme is part of the address, and changing it would
  // load the whole embed again
  const [theme] = useState(getEmbedTheme);

  const style = useMemo(
    () => ({ height: reportedHeight ?? X_DEFAULT_HEIGHT_PX }),
    [reportedHeight]
  );

  return (
    <iframe
      ref={iframeRef}
      src={`https://platform.twitter.com/embed/Tweet.html?id=${postId}&dnt=true&theme=${theme}`}
      title="X post"
      style={style}
      className="w-137 max-w-full border-0"
      allow="encrypted-media"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
});

const TikTokPost = memo(({ postId }: TPostProps) => (
  <iframe
    src={`https://www.tiktok.com/player/v1/${postId}?controls=1&autoplay=0`}
    title="TikTok post"
    className="h-150 w-84 max-w-full border-0"
    allow="fullscreen"
    allowFullScreen
    loading="lazy"
    referrerPolicy="strict-origin-when-cross-origin"
  />
));

type TSocialMediaOverrideProps = TPostProps & {
  provider: 'x' | 'tiktok';
};

const SocialMediaOverride = memo(
  ({ provider, postId }: TSocialMediaOverrideProps) => (
    <OverrideLayout>
      {provider === 'tiktok' ? (
        <TikTokPost postId={postId} />
      ) : (
        <XPost postId={postId} />
      )}
    </OverrideLayout>
  )
);

export { SocialMediaOverride };
