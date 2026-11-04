import path from 'path';

const PYTHON_MISSING_MESSAGE =
  'This bot is written in Python, and Python 3 was not found on this server.';

const VENV_DIR = '.venv';
const PROBE_TIMEOUT_MS = 10_000;

// windows answers `python` with a stub that opens the store when no python is installed,
// so a binary on the path only counts once it has run and said it is python 3
const PYTHON_CANDIDATES = ['python3', 'python'];

const isPython3 = async (binary: string) => {
  try {
    const probe = Bun.spawn({
      cmd: [binary, '-c', 'import sys; print(sys.version_info[0])'],
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'ignore',
      timeout: PROBE_TIMEOUT_MS
    });
    const [output, code] = await Promise.all([
      new Response(probe.stdout).text(),
      probe.exited
    ]);

    return code === 0 && output.trim() === '3';
  } catch {
    return false;
  }
};

// looked up every time rather than once, so a python installed after the server started is
// found without a restart
const findPython = async () => {
  for (const candidate of PYTHON_CANDIDATES) {
    const binary = Bun.which(candidate);

    if (binary && (await isPython3(binary))) return binary;
  }

  return undefined;
};

const getVenvPython = (botPath: string) =>
  process.platform === 'win32'
    ? path.join(botPath, VENV_DIR, 'Scripts', 'python.exe')
    : path.join(botPath, VENV_DIR, 'bin', 'python');

// the bot's own venv once its dependencies are installed, the server's python before that
const findBotPython = async (botPath: string) => {
  const venvPython = getVenvPython(botPath);

  if (await Bun.file(venvPython).exists()) return venvPython;

  return findPython();
};

export {
  PYTHON_MISSING_MESSAGE,
  VENV_DIR,
  findBotPython,
  findPython,
  getVenvPython
};
