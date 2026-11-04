import { zHttpUrl, type TMessageEmbed } from '@sandshark/shared';
import { z } from 'zod';
import { toStoredHtml } from './content';
import type { TGuildContext } from './guild';
import { htmlToMarkdown, type THtmlMentionLookups } from './markdown';

// discord's limits, per embed and across every embed of one message
const MAX_EMBEDS = 10;
const MAX_EMBED_TOTAL_CHARACTERS = 6_000;

const zMedia = z.object({ url: zHttpUrl });

// discord's embed object. type, video and provider are set by discord itself for link
// previews, so they are accepted and dropped
const zDiscordEmbed = z.object({
  title: z.string().max(256).optional(),
  description: z.string().max(4_096).optional(),
  url: zHttpUrl.optional(),
  timestamp: z.iso.datetime({ offset: true }).optional(),
  color: z.number().int().min(0).max(0xffffff).nullable().optional(),
  footer: z
    .object({
      text: z.string().min(1).max(2_048),
      icon_url: zHttpUrl.optional()
    })
    .optional(),
  author: z
    .object({
      name: z.string().min(1).max(256),
      url: zHttpUrl.optional(),
      icon_url: zHttpUrl.optional()
    })
    .optional(),
  fields: z
    .array(
      z.object({
        name: z.string().min(1).max(256),
        value: z.string().min(1).max(1_024),
        inline: z.boolean().optional()
      })
    )
    .max(25)
    .optional(),
  image: zMedia.optional(),
  thumbnail: zMedia.optional()
});

const zDiscordEmbeds = z.array(zDiscordEmbed).max(MAX_EMBEDS);

type TDiscordEmbed = z.infer<typeof zDiscordEmbed>;

const textLength = (embed: TDiscordEmbed) =>
  (embed.title?.length ?? 0) +
  (embed.description?.length ?? 0) +
  (embed.footer?.text.length ?? 0) +
  (embed.author?.name.length ?? 0) +
  (embed.fields ?? []).reduce(
    (total, field) => total + field.name.length + field.value.length,
    0
  );

const hasVisibleContent = (embed: TDiscordEmbed) =>
  !!(
    embed.title ||
    embed.description ||
    embed.fields?.length ||
    embed.image ||
    embed.thumbnail ||
    embed.author ||
    embed.footer
  );

// discord refuses embeds whose text adds up to more than 6000 characters, and an embed with
// nothing in it
const areEmbedsValid = (embeds: TDiscordEmbed[]) =>
  embeds.every(hasVisibleContent) &&
  embeds.reduce((total, embed) => total + textLength(embed), 0) <=
    MAX_EMBED_TOTAL_CHARACTERS;

// the description and field values are markdown, as in message content, and are stored as
// the same sanitized html
const toStoredEmbeds = async (
  embeds: TDiscordEmbed[],
  guild: TGuildContext
): Promise<TMessageEmbed[]> =>
  Promise.all(
    embeds.map(async (embed) => ({
      title: embed.title,
      description: embed.description
        ? await toStoredHtml(embed.description, guild)
        : undefined,
      url: embed.url,
      color: embed.color ?? undefined,
      timestamp: embed.timestamp,
      footer: embed.footer
        ? { text: embed.footer.text, iconUrl: embed.footer.icon_url }
        : undefined,
      author: embed.author
        ? {
            name: embed.author.name,
            url: embed.author.url,
            iconUrl: embed.author.icon_url
          }
        : undefined,
      fields: embed.fields
        ? await Promise.all(
            embed.fields.map(async (field) => ({
              name: field.name,
              value: await toStoredHtml(field.value, guild),
              inline: field.inline ?? false
            }))
          )
        : undefined,
      image: embed.image,
      thumbnail: embed.thumbnail
    }))
  );

const serializeEmbed = (
  embed: TMessageEmbed,
  lookups: THtmlMentionLookups
) => ({
  type: 'rich',
  title: embed.title,
  description: embed.description
    ? htmlToMarkdown(embed.description, lookups)
    : undefined,
  url: embed.url,
  color: embed.color,
  timestamp: embed.timestamp,
  footer: embed.footer
    ? { text: embed.footer.text, icon_url: embed.footer.iconUrl }
    : undefined,
  author: embed.author
    ? {
        name: embed.author.name,
        url: embed.author.url,
        icon_url: embed.author.iconUrl
      }
    : undefined,
  fields: embed.fields?.map((field) => ({
    name: field.name,
    value: htmlToMarkdown(field.value, lookups),
    inline: field.inline
  })),
  image: embed.image,
  thumbnail: embed.thumbnail
});

export {
  areEmbedsValid,
  serializeEmbed,
  toStoredEmbeds,
  zDiscordEmbeds,
  type TDiscordEmbed
};
