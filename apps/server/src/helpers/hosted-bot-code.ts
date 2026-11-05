import {
  ActivityLogType,
  HOSTED_BOT_GITHUB_URL_REGEX,
  HOSTED_BOT_MAX_ARCHIVE_SIZE,
  HostedBotSourceType,
  type HostedBotTemplate
} from '@sandshark/shared';
import { randomUUIDv7 } from 'bun';
import fs from 'fs/promises';
import path from 'path';
import { upsertHostedBot } from '../db/mutations/hosted-bots';
import { getHostedBot } from '../db/queries/hosted-bots';
import { logger } from '../logger';
import { enqueueActivityLog } from '../queues/activity-log';
import { getHostedBotPath, HostedBotRuntime } from '../runtimes/hosted-bot';
import { invariant } from '../utils/invariant';
import { unzipBlobToDirectory } from '../utils/zip';
import { hasHostedBotDependencies } from './hosted-bot-install';
import { HOSTED_BOT_TEMPLATES } from './hosted-bot-templates';
import type { THostedBotRef } from './hosted-bots';
import { TMP_PATH } from './paths';

type THostedBotCodeSource = {
  type: HostedBotSourceType;
  url: string | null;
  ref: string | null;
};

const MAX_ARCHIVE_MB = HOSTED_BOT_MAX_ARCHIVE_SIZE / 1024 / 1024;

// a zip of a folder holds that folder at its root, and github's archives always do. the
// bot's own files are what is inside it
const findCodeRoot = async (dir: string) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const [only] = entries;

  if (entries.length === 1 && only?.isDirectory()) {
    return path.join(dir, only.name);
  }

  return dir;
};

// off the request path: the install can take minutes, and its output goes to the bot's log
const installInBackground = (botId: number) => {
  HostedBotRuntime.install(botId).catch((error) => {
    logger.error('hosted bot %d: install failed', botId, error);
  });
};

// an install that an upload or update starts is part of that code change, logged with it
const installHostedBotDependencies = async (
  bot: THostedBotRef,
  actorUserId: number
) => {
  invariant(await hasHostedBotDependencies(getHostedBotPath(bot.id)), {
    code: 'BAD_REQUEST',
    message:
      'This bot has no package.json, requirements.txt or pyproject.toml to install from.'
  });

  installInBackground(bot.id);

  enqueueActivityLog({
    type: ActivityLogType.INSTALLED_HOSTED_BOT_DEPENDENCIES,
    userId: actorUserId,
    details: { botId: bot.id, name: bot.name }
  });
};

// records where the new code came from, and installs its dependencies, which restarts the
// bot if it was running, or else restarts it on the new code straight away
const onHostedBotCodeChanged = async (
  bot: THostedBotRef,
  actorUserId: number,
  source: THostedBotCodeSource,
  template: HostedBotTemplate | null = null
) => {
  const botId = bot.id;

  await upsertHostedBot(botId, {
    sourceType: source.type,
    sourceUrl: source.url,
    sourceRef: source.ref,
    codeUpdatedAt: Date.now()
  });

  enqueueActivityLog({
    type: ActivityLogType.UPDATED_HOSTED_BOT_CODE,
    userId: actorUserId,
    details: {
      botId,
      name: bot.name,
      sourceType: source.type,
      sourceUrl: source.url,
      sourceRef: source.ref,
      template
    }
  });

  if (await hasHostedBotDependencies(getHostedBotPath(botId))) {
    installInBackground(botId);
    return;
  }

  const { enabled } = (await getHostedBot(botId)) ?? { enabled: false };

  if (enabled) {
    await HostedBotRuntime.stop(botId);
    await HostedBotRuntime.start(botId);
  }
};

// the archive's files replace the ones of the same name and everything else stays, so data
// a bot keeps next to its code (json files, sqlite) survives an update. a bot with
// dependencies has them installed, which restarts it if it was running
const replaceHostedBotCode = async (
  bot: THostedBotRef,
  actorUserId: number,
  archive: Blob | Uint8Array,
  source: THostedBotCodeSource
) => {
  const botId = bot.id;
  const staging = path.join(TMP_PATH, `hosted-bot-${botId}-${randomUUIDv7()}`);
  const botPath = getHostedBotPath(botId);

  try {
    let unpacked = true;

    try {
      await unzipBlobToDirectory(archive, staging);
    } catch {
      unpacked = false;
    }

    invariant(unpacked, {
      code: 'BAD_REQUEST',
      message: 'The archive could not be read as a zip file.'
    });

    const root = await findCodeRoot(staging);

    await fs.mkdir(botPath, { recursive: true });
    await fs.cp(root, botPath, { recursive: true, force: true });
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }

  await onHostedBotCodeChanged(bot, actorUserId, source);
};

// the template's files are the bot's own from then on, to change and upload like any code
const writeHostedBotTemplate = async (
  bot: THostedBotRef,
  actorUserId: number,
  template: HostedBotTemplate
) => {
  const botId = bot.id;
  const row = await getHostedBot(botId);

  invariant(!row?.codeUpdatedAt, {
    code: 'BAD_REQUEST',
    message: 'This bot already has code. Upload or update it instead.'
  });

  const botPath = getHostedBotPath(botId);

  await fs.mkdir(botPath, { recursive: true });
  await Promise.all(
    Object.entries(HOSTED_BOT_TEMPLATES[template]).map(([name, content]) =>
      fs.writeFile(path.join(botPath, name), content)
    )
  );

  await onHostedBotCodeChanged(
    bot,
    actorUserId,
    { type: HostedBotSourceType.UPLOAD, url: null, ref: null },
    template
  );
};

const setHostedBotGithubSource = async (
  bot: THostedBotRef,
  actorUserId: number,
  url: string,
  ref: string | null
) => {
  await upsertHostedBot(bot.id, {
    sourceType: HostedBotSourceType.GITHUB,
    sourceUrl: url,
    sourceRef: ref
  });

  enqueueActivityLog({
    type: ActivityLogType.UPDATED_HOSTED_BOT,
    userId: actorUserId,
    details: { botId: bot.id, name: bot.name, sourceUrl: url, sourceRef: ref }
  });
};

// fetched as an archive through github's api, so the server needs no git. the ref is
// optional, without one github answers with the default branch
const downloadGithubArchive = async (url: string, ref: string | null) => {
  const match = HOSTED_BOT_GITHUB_URL_REGEX.exec(url);

  invariant(match, {
    code: 'BAD_REQUEST',
    message: 'This is not a GitHub repository address.'
  });

  const [, owner, repo] = match;
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/zipball${ref ? `/${ref}` : ''}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'SandShark'
      }
    }
  );

  invariant(response.status !== 404, {
    code: 'BAD_REQUEST',
    message:
      'The repository or branch was not found. Only public repositories can be used.'
  });
  invariant(response.ok, {
    code: 'BAD_GATEWAY',
    message: `GitHub could not send the code (status ${response.status}).`
  });

  const declared = Number(response.headers.get('content-length') ?? 0);

  invariant(declared <= HOSTED_BOT_MAX_ARCHIVE_SIZE, {
    code: 'BAD_REQUEST',
    message: `The code is larger than ${MAX_ARCHIVE_MB} MB.`
  });

  const archive = new Uint8Array(await response.arrayBuffer());

  invariant(archive.byteLength <= HOSTED_BOT_MAX_ARCHIVE_SIZE, {
    code: 'BAD_REQUEST',
    message: `The code is larger than ${MAX_ARCHIVE_MB} MB.`
  });

  return archive;
};

const updateHostedBotFromGithub = async (
  bot: THostedBotRef,
  actorUserId: number
) => {
  const row = await getHostedBot(bot.id);

  invariant(row?.sourceType === HostedBotSourceType.GITHUB && row.sourceUrl, {
    code: 'BAD_REQUEST',
    message: 'This bot has no GitHub repository set.'
  });

  const archive = await downloadGithubArchive(row.sourceUrl, row.sourceRef);

  await replaceHostedBotCode(bot, actorUserId, archive, {
    type: HostedBotSourceType.GITHUB,
    url: row.sourceUrl,
    ref: row.sourceRef
  });
};

export {
  installHostedBotDependencies,
  replaceHostedBotCode,
  setHostedBotGithubSource,
  updateHostedBotFromGithub,
  writeHostedBotTemplate
};
