import { getResWidthHeight } from '@/helpers/get-res-with-height';
import type { TDeviceSettings } from '@/types';
import type { Producer } from 'mediasoup-client/types';
import { stopMediaStream } from './voice-operation';

const replaceWebcamTrack = async (
  devices: TDeviceSettings,
  producer: Producer,
  isCurrent: () => boolean
) => {
  const hasSpecificWebcam =
    !!devices.webcamId && devices.webcamId !== 'default';
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: hasSpecificWebcam ? { exact: devices.webcamId } : undefined,
      frameRate: devices.webcamFramerate,
      ...getResWidthHeight(devices.webcamResolution)
    },
    audio: false
  });
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error('The selected camera has no video track.');
    if (!isCurrent()) throw new Error('Voice session changed.');
    await producer.replaceTrack({ track });
    if (!isCurrent()) throw new Error('Voice session changed.');
    return { stream, track };
  } catch (error) {
    stopMediaStream(stream);
    throw error;
  }
};

export { replaceWebcamTrack };
