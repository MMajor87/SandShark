const getMediaDevices = () => {
  if (typeof navigator === 'undefined') return undefined;

  return navigator.mediaDevices;
};

const isMediaDevicesSupported = () => !!getMediaDevices();

export { getMediaDevices, isMediaDevicesSupported };
