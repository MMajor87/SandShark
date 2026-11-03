import { SOUNDBOARD_NAME_MAX_LENGTH } from '@sandshark/shared';

export const getSoundNameFromFile = (fileName: string) => {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const spacedName = baseName.replace(/[_-]+/g, ' ');
  const trimmedName = spacedName.trim();
  const name = trimmedName.slice(0, SOUNDBOARD_NAME_MAX_LENGTH);

  return name || 'Sound';
};

// reads the length from the file's metadata, so an overlong sound is caught before
// it is uploaded. some webm files report no length at all, playback still cuts those off
export const getAudioDuration = (file: File) =>
  new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();

    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The file could not be read as audio.'));
    };
    audio.src = url;
  });
