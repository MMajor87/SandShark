import { lstat, readdir, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';

type TOptions = {
  keep?: number;
  maxAgeDays?: number;
  maxDeletes?: number;
  apply?: boolean;
  now?: number;
};
type TEntry = {
  name: string;
  path: string;
  action: 'keep' | 'preserve' | 'delete' | 'deleted';
  reason: string;
  createdAt?: number;
};
const normalized = (value: string) =>
  process.platform === 'win32' ? value.toLowerCase() : value;
const samePath = (left: string, right: string) =>
  normalized(left) === normalized(right);
const isInside = (parent: string, child: string) =>
  normalized(child).startsWith(`${normalized(parent)}${path.sep}`);
const isMissing = (error: unknown) =>
  (error as NodeJS.ErrnoException).code === 'ENOENT';
const protectedNames = new Set([
  'data',
  'data-test',
  'e2e-data',
  'backups',
  'backup',
  'development-backup',
  'release',
  'win-unpacked',
  '.git',
  '.integration',
  '.keep'
]);
const containsProtectedFiles = async (directory: string): Promise<boolean> => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      entry.isSymbolicLink() ||
      protectedNames.has(entry.name.toLowerCase()) ||
      /\.(sqlite(?:-wal|-shm)?|db|exe|pfx|p12)$/i.test(entry.name)
    )
      return true;
    if (
      entry.isDirectory() &&
      (await containsProtectedFiles(path.join(directory, entry.name)))
    )
      return true;
  }
  return false;
};

// only explicitly managed runs are eligible; existing integration evidence is outside this root.
const pruneTestArtifacts = async (
  workspace: string,
  options: TOptions = {}
): Promise<TEntry[]> => {
  const {
    keep = 5,
    maxAgeDays = 14,
    maxDeletes = 20,
    apply = false,
    now = Date.now()
  } = options;
  for (const [name, value, minimum] of [
    ['keep', keep, 1],
    ['maxAgeDays', maxAgeDays, 1],
    ['maxDeletes', maxDeletes, 1]
  ] as const) {
    if (!Number.isSafeInteger(value) || value < minimum)
      throw new Error(`Invalid ${name}.`);
  }
  if (!Number.isFinite(now)) throw new Error('Invalid current time.');
  const workspaceRoot = await realpath(workspace);
  const artifacts = path.join(workspaceRoot, '.artifacts');
  const root = path.join(artifacts, 'test-runs');
  for (const directory of [artifacts, root]) {
    try {
      if (
        (await lstat(directory)).isSymbolicLink() ||
        !samePath(await realpath(directory), directory)
      )
        throw new Error('Artifact root must not be a link.');
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }
  const entries: TEntry[] = [];
  for (const child of await readdir(root, { withFileTypes: true })) {
    const target = path.resolve(root, child.name);
    const entry: TEntry = {
      name: child.name,
      path: target,
      action: 'preserve',
      reason: 'Not a managed run.'
    };
    entries.push(entry);
    if (
      !child.isDirectory() ||
      child.isSymbolicLink() ||
      !isInside(root, target) ||
      !/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(child.name)
    )
      continue;
    if (
      !samePath(await realpath(target), target) ||
      (await containsProtectedFiles(target))
    ) {
      entry.reason = 'Contains protected data, evidence or links.';
      continue;
    }
    let metadata: unknown;
    try {
      metadata = JSON.parse(
        await readFile(path.join(target, 'run.json'), 'utf8')
      );
    } catch {
      continue;
    }
    if (typeof metadata !== 'object' || metadata === null) continue;
    const { createdAt, releaseVerification } = metadata as Record<
      string,
      unknown
    >;
    if (
      releaseVerification !== 'complete' &&
      releaseVerification !== 'not-required'
    ) {
      entry.reason = 'Release verification is pending or unspecified.';
      continue;
    }
    const timestamp =
      typeof createdAt === 'string' ? Date.parse(createdAt) : NaN;
    if (!Number.isFinite(timestamp) || timestamp > now) {
      entry.reason = 'Invalid run date.';
      continue;
    }
    entry.createdAt = timestamp;
    entry.action = 'keep';
    entry.reason = 'Retained by count or age.';
  }
  const eligible = entries
    .filter((entry) => entry.action === 'keep')
    .sort(
      (a, b) => b.createdAt! - a.createdAt! || a.name.localeCompare(b.name)
    );
  let selected = 0;
  for (const [index, entry] of eligible.entries()) {
    if (
      index < keep ||
      entry.createdAt! > now - maxAgeDays * 86_400_000 ||
      selected >= maxDeletes
    )
      continue;
    selected += 1;
    entry.action = 'delete';
    entry.reason = 'Exceeds retained count and age.';
    if (apply) {
      // verify the absolute target again immediately before recursive removal.
      if (
        !samePath(await realpath(root), root) ||
        !samePath(await realpath(entry.path), entry.path) ||
        !isInside(root, entry.path) ||
        (await lstat(entry.path)).isSymbolicLink() ||
        (await containsProtectedFiles(entry.path))
      )
        throw new Error('Artifact path changed during cleanup.');
      const metadata = JSON.parse(
        await readFile(path.join(entry.path, 'run.json'), 'utf8')
      ) as { releaseVerification?: string };
      if (
        metadata.releaseVerification !== 'complete' &&
        metadata.releaseVerification !== 'not-required'
      )
        throw new Error('Release evidence was protected during cleanup.');
      await rm(entry.path, { recursive: true });
      entry.action = 'deleted';
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply'))
    throw new Error('Usage: bun test-artifact-retention.ts [--apply]');
  const workspace = path.resolve(import.meta.dir, '../../..');
  const apply = args.includes('--apply');
  const entries = await pruneTestArtifacts(workspace, { apply });
  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        root: path.join(workspace, '.artifacts/test-runs'),
        keep: 5,
        maxAgeDays: 14,
        maxDeletes: 20,
        entries
      },
      null,
      2
    )
  );
}
export { pruneTestArtifacts };
