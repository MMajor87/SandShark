type TVolumeSettings = Record<string, number>;

const getSavedOrDefaultVolume = (
  volumes: TVolumeSettings,
  key: string,
  muteSharedStreamAudioByDefault: boolean
) =>
  volumes[key] ??
  (muteSharedStreamAudioByDefault && key.startsWith('userscreen-') ? 0 : 100);

export { getSavedOrDefaultVolume };
