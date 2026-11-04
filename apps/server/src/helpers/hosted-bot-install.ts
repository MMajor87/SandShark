import path from 'path';
import {
  findPython,
  getVenvPython,
  PYTHON_MISSING_MESSAGE,
  VENV_DIR
} from './hosted-bot-python';

const exists = (botPath: string, name: string) =>
  Bun.file(path.join(botPath, name)).exists();

const findDependencyFiles = async (botPath: string) => {
  const [packageJson, requirements, pyproject] = await Promise.all([
    exists(botPath, 'package.json'),
    exists(botPath, 'requirements.txt'),
    exists(botPath, 'pyproject.toml')
  ]);

  return { packageJson, requirements, pyproject };
};

const hasHostedBotDependencies = async (botPath: string) => {
  const { packageJson, requirements, pyproject } =
    await findDependencyFiles(botPath);

  return packageJson || requirements || pyproject;
};

// the commands that install a bot's dependencies, run in its folder one after the other.
// python packages go into a venv of the bot's own, which survives code updates like the
// bot's other files. requirements.txt wins over pyproject.toml, since a project that has
// both usually pins its versions in the first
const getHostedBotInstallSteps = async (botPath: string) => {
  const { packageJson, requirements, pyproject } =
    await findDependencyFiles(botPath);
  const steps: string[][] = [];

  if (packageJson) steps.push([process.execPath, 'install']);

  if (!requirements && !pyproject) return steps;

  const venvPython = getVenvPython(botPath);

  if (!(await Bun.file(venvPython).exists())) {
    const python = await findPython();

    if (!python) throw new Error(PYTHON_MISSING_MESSAGE);

    steps.push([python, '-m', 'venv', VENV_DIR]);
  }

  steps.push([
    venvPython,
    '-m',
    'pip',
    'install',
    '--disable-pip-version-check',
    ...(requirements ? ['-r', 'requirements.txt'] : ['.'])
  ]);

  return steps;
};

export { getHostedBotInstallSteps, hasHostedBotDependencies };
