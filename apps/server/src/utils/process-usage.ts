import fs from 'fs/promises';

type TProcessUsage = {
  memoryBytes: number;
  cpuMs: number;
};

// linux counts cpu time in ticks of USER_HZ, which is 100 on every architecture it runs on
const CLOCK_TICK_MS = 10;

// the resident memory and total cpu time of a running process, read from /proc. undefined
// on other platforms, where the only way to ask is spawning a program on every read, and
// for a process that has already exited
const readProcessUsage = async (
  pid: number
): Promise<TProcessUsage | undefined> => {
  if (process.platform !== 'linux') return undefined;

  try {
    const [stat, status] = await Promise.all([
      fs.readFile(`/proc/${pid}/stat`, 'utf8'),
      fs.readFile(`/proc/${pid}/status`, 'utf8')
    ]);
    // the command name before the fields is in parentheses and can hold spaces and
    // parentheses itself, so the fields start after the last one
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const utime = Number(fields[11]);
    const stime = Number(fields[12]);
    const rss = /^VmRSS:\s+(\d+) kB/m.exec(status);

    if (!rss || Number.isNaN(utime) || Number.isNaN(stime)) return undefined;

    return {
      memoryBytes: Number(rss[1]) * 1024,
      cpuMs: (utime + stime) * CLOCK_TICK_MS
    };
  } catch {
    return undefined;
  }
};

export { readProcessUsage };
