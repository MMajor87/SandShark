import { memo } from 'react';
import { OverrideLayout } from './layout';

type TSocialMediaOverrideProps = {
  provider: 'x' | 'tiktok';
  postId: string;
};

const SocialMediaOverride = memo(
  ({ provider, postId }: TSocialMediaOverrideProps) => {
    const isTikTok = provider === 'tiktok';
    const src = isTikTok
      ? `https://www.tiktok.com/player/v1/${postId}?controls=1&autoplay=0`
      : `https://platform.twitter.com/embed/Tweet.html?id=${postId}&dnt=true`;

    return (
      <OverrideLayout>
        <iframe
          src={src}
          title={isTikTok ? 'TikTok post' : 'X post'}
          className={
            isTikTok
              ? 'h-150 w-84 max-w-full border-0'
              : 'h-138 w-137 max-w-full border-0'
          }
          allow={isTikTok ? 'fullscreen' : 'encrypted-media'}
          allowFullScreen={isTikTok}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </OverrideLayout>
    );
  }
);

export { SocialMediaOverride };
