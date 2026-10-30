import { Emoji } from '@/components/emoji';
import { findGitHubEmoji } from '@/components/emoji/helpers';
import { customEmojiFileByNameSelector } from '@/features/server/emojis/selectors';
import type { IRootState } from '@/features/store';
import { memo } from 'react';
import { useSelector } from 'react-redux';

type TMessageCustomEmojiProps = { name: string };

const MessageCustomEmoji = memo(({ name }: TMessageCustomEmojiProps) => {
  const file = useSelector((state: IRootState) =>
    customEmojiFileByNameSelector(state, name)
  );

  if (!file && !findGitHubEmoji(name, null)) return <span>:{name}:</span>;

  return <Emoji emoji={name} file={file} />;
});

export { MessageCustomEmoji };
