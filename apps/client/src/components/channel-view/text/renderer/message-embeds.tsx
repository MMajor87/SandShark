import type { TMessageEmbed } from '@sandshark/shared';
import { format } from 'date-fns';
import { memo, useMemo } from 'react';
import { parseMessageHtml } from './content-cache';

type TMessageEmbedProps = {
  embed: TMessageEmbed;
  messageId: number;
};

const toHexColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

// images come from wherever the bot points, like link preview images, so no referrer is sent
const EmbedImage = memo(
  ({ url, className }: { url: string; className: string }) => (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={className}
    />
  )
);

const EmbedLink = memo(
  ({ url, children }: { url?: string; children: React.ReactNode }) => {
    if (!url) return <>{children}</>;

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
      >
        {children}
      </a>
    );
  }
);

// a bot's rich embed, laid out as discord does: a coloured bar, the author, a linked
// title, the description, fields three to a row when inline, an image, and a footer
const MessageEmbed = memo(({ embed, messageId }: TMessageEmbedProps) => {
  const description = useMemo(
    () =>
      embed.description ? parseMessageHtml(embed.description, messageId) : null,
    [embed.description, messageId]
  );

  const fields = useMemo(
    () =>
      (embed.fields ?? []).map((field) => ({
        ...field,
        content: parseMessageHtml(field.value, messageId)
      })),
    [embed.fields, messageId]
  );

  const style = useMemo(
    () =>
      embed.color === undefined
        ? undefined
        : { borderLeftColor: toHexColor(embed.color) },
    [embed.color]
  );

  const timestamp = useMemo(
    () => (embed.timestamp ? format(new Date(embed.timestamp), 'PPp') : null),
    [embed.timestamp]
  );

  return (
    <div
      className="flex max-w-lg gap-3 rounded-md border border-l-4 border-border bg-muted/30 p-3"
      style={style}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {embed.author && (
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {embed.author.iconUrl && (
              <EmbedImage
                url={embed.author.iconUrl}
                className="size-5 rounded-full object-cover"
              />
            )}
            <EmbedLink url={embed.author.url}>{embed.author.name}</EmbedLink>
          </div>
        )}
        {embed.title && (
          <div className="text-sm font-semibold">
            <EmbedLink url={embed.url}>{embed.title}</EmbedLink>
          </div>
        )}
        {description && (
          <div className="prose max-w-full text-sm wrap-break-word msg-content">
            {description}
          </div>
        )}
        {fields.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {fields.map((field, index) => (
              <div
                key={index}
                className={field.inline ? 'col-span-1 min-w-0' : 'col-span-3'}
              >
                <div className="text-xs font-semibold">{field.name}</div>
                <div className="prose max-w-full text-sm wrap-break-word msg-content">
                  {field.content}
                </div>
              </div>
            ))}
          </div>
        )}
        {embed.image && (
          <EmbedImage
            url={embed.image.url}
            className="mt-1 max-h-80 max-w-full rounded object-contain"
          />
        )}
        {(embed.footer || timestamp) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {embed.footer?.iconUrl && (
              <EmbedImage
                url={embed.footer.iconUrl}
                className="size-4 rounded-full object-cover"
              />
            )}
            {embed.footer && <span>{embed.footer.text}</span>}
            {embed.footer && timestamp && <span>•</span>}
            {timestamp && <span>{timestamp}</span>}
          </div>
        )}
      </div>
      {embed.thumbnail && (
        <EmbedImage
          url={embed.thumbnail.url}
          className="size-20 shrink-0 rounded object-cover"
        />
      )}
    </div>
  );
});

type TMessageEmbedsProps = {
  embeds: TMessageEmbed[] | null;
  messageId: number;
};

const MessageEmbeds = memo(({ embeds, messageId }: TMessageEmbedsProps) => {
  if (!embeds?.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {embeds.map((embed, index) => (
        <MessageEmbed key={index} embed={embed} messageId={messageId} />
      ))}
    </div>
  );
});

export { MessageEmbeds };
