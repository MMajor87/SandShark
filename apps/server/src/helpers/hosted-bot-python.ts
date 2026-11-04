import path from 'path';
import { findBinary } from '../utils/find-binary';

const PYTHON_MISSING_MESSAGE =
  'This bot is written in Python, and Python 3 was not found on this server.';

const VENV_DIR = '.venv';

const findPython = () =>
  findBinary(
    ['python3', 'python'],
    ['-c', 'import sys; print(sys.version_info[0])'],
    (major) => major === '3'
  );

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
  findBotPython,
  findPython,
  getVenvPython,
  PYTHON_MISSING_MESSAGE,
  VENV_DIR
};
