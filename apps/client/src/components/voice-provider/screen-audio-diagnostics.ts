import { logVoice } from '@/helpers/browser-logger';
import type { Producer } from 'mediasoup-client/types';

const monitorScreenAudio = (producer: Producer) => {
  const track = producer.track;
  if (!track) return;

  const reportTrack = () => {
    const settings = track.getSettings();
    logVoice('Screen audio track state', {
      producerId: producer.id,
      readyState: track.readyState,
      enabled: track.enabled,
      muted: track.muted,
      paused: producer.paused,
      sampleRate: settings.sampleRate,
      channelCount: settings.channelCount
    });
  };
  let collecting = false;
  let stopped = false;
  let previousBytes = 0;
  const collect = async () => {
    if (collecting || stopped) return;
    collecting = true;
    try {
      const stats = await producer.getStats();
      if (stopped) return;
      stats.forEach((entry) => {
        if (entry.type === 'outbound-rtp' && !entry.isRemote) {
          logVoice('Screen audio outbound statistics', {
            producerId: producer.id,
            bytesSent: entry.bytesSent,
            bytesSinceLastReport: entry.bytesSent - previousBytes,
            packetsSent: entry.packetsSent
          });
          previousBytes = entry.bytesSent;
        }
        if (entry.type === 'media-source' && entry.kind === 'audio') {
          logVoice('Screen audio source statistics', {
            producerId: producer.id,
            audioLevel: entry.audioLevel,
            totalAudioEnergy: entry.totalAudioEnergy,
            totalSamplesDuration: entry.totalSamplesDuration
          });
        }
      });
    } catch (error) {
      if (!stopped) logVoice('Screen audio statistics failed', { error });
    } finally {
      collecting = false;
    }
  };
  const timer = window.setInterval(() => void collect(), 10_000);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(timer);
    track.removeEventListener('mute', reportTrack);
    track.removeEventListener('unmute', reportTrack);
    track.removeEventListener('ended', reportTrack);
    producer.observer.off('close', stop);
    logVoice('Screen audio monitoring stopped', { producerId: producer.id });
  };
  track.addEventListener('mute', reportTrack);
  track.addEventListener('unmute', reportTrack);
  track.addEventListener('ended', reportTrack);
  producer.observer.once('close', stop);
  reportTrack();
  void collect();
};

export { monitorScreenAudio };
