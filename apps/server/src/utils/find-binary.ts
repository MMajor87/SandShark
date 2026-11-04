const PROBE_TIMEOUT_MS = 10_000;

const probe = async (binary: string, args: string[]) => {
  try {
    const child = Bun.spawn({
      cmd: [binary, ...args],
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'ignore',
      timeout: PROBE_TIMEOUT_MS
    });
    const [output, code] = await Promise.all([
      new Response(child.stdout).text(),
      child.exited
    ]);

    return code === 0 ? output.trim() : undefined;
  } catch {
    return undefined;
  }
};

// the first of the candidates on the path that runs and answers the probe as expected. a
// binary on the path only counts once it has run: windows answers `python` with a stub that
// opens the store when no python is installed. looked up every time rather than once, so a
// runtime installed after the server started is found without a restart
const findBinary = async (
  candidates: string[],
  args: string[],
  accepts: (output: string) => boolean
) => {
  for (const candidate of candidates) {
    const binary = Bun.which(candidate);

    if (!binary) continue;

    const output = await probe(binary, args);

    if (output !== undefined && accepts(output)) return binary;
  }

  return undefined;
};

export { findBinary };
