import type { HostedBotStatus } from '@sandshark/shared';
import { getChannelNamesByIds } from '../db/queries/channels';
import { getHostedBotNames } from '../db/queries/hosted-bots';
import { getUserNamesByIds } from '../db/queries/users';
import { HostedBotRuntime } from '../runtimes/hosted-bot';
import { VoiceRuntime } from '../runtimes/voice';
import { SERVER_VERSION } from '../utils/env';
import { getOnlineUserIds } from '../utils/wss';

type TMonitorStatus = {
  version: string;
  startedAt: number;
  memoryBytes: number;
  cpuPercent: number | null;
  onlineUsers: { id: number; name: string }[];
  voiceChannels: { id: number; name: string; userCount: number }[];
  hostedBots: { id: number; name: string; status: HostedBotStatus }[];
};

let lastCpuSample: { cpuMicros: number; at: number } | null = null;

// share of one core since the previous call, the way the hosted bot usage reports it. the first
// call has nothing to compare with, so it reports null rather than an average since start
const getCpuPercent = () => {
  const { user, system } = process.cpuUsage();
  const sample = { cpuMicros: user + system, at: performance.now() };
  const previous = lastCpuSample;

  lastCpuSample = sample;

  if (!previous || sample.at <= previous.at) return null;

  const cpuMs = (sample.cpuMicros - previous.cpuMicros) / 1000;

  return Math.round((cpuMs / (sample.at - previous.at)) * 1000) / 10;
};

const getMonitorStatus = async (): Promise<TMonitorStatus> => {
  const voiceMap = VoiceRuntime.getVoiceMap();
  // the server keeps a runtime for every voice channel from the start, so only the ones with
  // someone in them are active
  const voiceChannelIds = Object.entries(voiceMap)
    .filter(([, { users }]) => Object.keys(users).length > 0)
    .map(([id]) => Number(id));

  const [onlineUsers, voiceChannelNames, hostedBots] = await Promise.all([
    getUserNamesByIds(getOnlineUserIds()),
    getChannelNamesByIds(voiceChannelIds),
    getHostedBotNames()
  ]);

  const voiceChannels = voiceChannelNames.map(({ id, name }) => {
    const channel = voiceMap[id];
    const userCount = channel ? Object.keys(channel.users).length : 0;

    return { id, name, userCount };
  });

  return {
    version: SERVER_VERSION,
    startedAt: Date.now() - Math.round(process.uptime() * 1000),
    memoryBytes: process.memoryUsage.rss(),
    cpuPercent: getCpuPercent(),
    onlineUsers,
    voiceChannels,
    hostedBots: hostedBots.map(({ id, name }) => {
      const { status } = HostedBotRuntime.getState(id);

      return { id, name, status };
    })
  };
};

export { getMonitorStatus, type TMonitorStatus };
