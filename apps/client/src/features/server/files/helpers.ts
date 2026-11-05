import type { IRootState } from '@/features/store';
import type { TFile } from '@sandshark/shared';

// a file is renewed once its signed url has less than this left. it covers two refresh
// intervals, so a url is always renewed before it runs out even if one refresh fails
export const FILE_ACCESS_RENEW_MARGIN_MS = 10 * 60_000;

// a server without signed urls gives files no expiry, and those never need renewing
const isRenewalDue = (file: TFile, now: number) =>
  file._accessTokenExpiresAt !== undefined &&
  file._accessTokenExpiresAt - now < FILE_ACCESS_RENEW_MARGIN_MS;

// the ids of every file the client holds a url for: messages, their reactions, custom emoji
// and soundboard sounds. with dueOnly, only those whose url is about to run out, since renewing
// a url changes it and makes every image and video showing that file load again
export const getHeldFileIds = (
  state: IRootState,
  now: number,
  dueOnly: boolean
) => {
  const ids = new Set<number>();

  const add = (file: TFile | null | undefined) => {
    if (!file) return;

    if (!dueOnly || isRenewalDue(file, now)) ids.add(file.id);
  };

  for (const emoji of state.server.emojis) add(emoji.file);

  for (const sound of state.server.soundboardSounds) add(sound.file);

  for (const messages of Object.values(state.server.messagesMap)) {
    for (const message of messages) {
      for (const file of message.files) add(file);

      for (const reaction of message.reactions) add(reaction.file);
    }
  }

  return [...ids];
};
