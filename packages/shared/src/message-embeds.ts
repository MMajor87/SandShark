// a rich embed on a message, which only a bot can send. description and field values are
// sanitized message html, everything else plain text or an http(s) url
export type TMessageEmbed = {
  title?: string;
  description?: string;
  url?: string;
  // a 24 bit rgb colour for the bar down the side
  color?: number;
  timestamp?: string;
  footer?: { text: string; iconUrl?: string };
  author?: { name: string; url?: string; iconUrl?: string };
  fields?: { name: string; value: string; inline: boolean }[];
  image?: { url: string };
  thumbnail?: { url: string };
};
