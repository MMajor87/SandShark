import { HostedBotJsRuntime } from '@sandshark/shared';
import type { THostedBotEntry } from './hosted-bot-entry';
import { findNode, NODE_MISSING_MESSAGE } from './hosted-bot-node';
import { findBotPython, PYTHON_MISSING_MESSAGE } from './hosted-bot-python';

// the program that runs the bot's entry, undefined when it is not installed on this server.
// bun is the server's own binary, so it is always there
const findHostedBotInterpreter = async (
  botPath: string,
  entry: THostedBotEntry,
  jsRuntime: HostedBotJsRuntime
) => {
  if (entry.language === 'python') return findBotPython(botPath);

  if (jsRuntime === HostedBotJsRuntime.NODE) return findNode();

  return process.execPath;
};

const getMissingInterpreterMessage = (entry: THostedBotEntry) =>
  entry.language === 'python' ? PYTHON_MISSING_MESSAGE : NODE_MISSING_MESSAGE;

export { findHostedBotInterpreter, getMissingInterpreterMessage };
