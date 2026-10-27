import { afterEach, expect, test } from 'bun:test';
import {
  access,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pruneTestArtifacts } from '../test-artifact-retention';

const workspaces: string[] = [];
const now = Date.UTC(2026, 9, 27);
const setup = async () => {
  const workspace = await mkdtemp(
    path.join(tmpdir(), 'sandshark-retention-test-')
  );
  workspaces.push(workspace);
  const root = path.join(workspace, '.artifacts/test-runs');
  await mkdir(root, { recursive: true });
  const run = async (
    name: string,
    days: number,
    releaseVerification = 'not-required'
  ) => {
    const directory = path.join(root, name);
    await mkdir(directory);
    await writeFile(
      path.join(directory, 'run.json'),
      JSON.stringify({
        createdAt: new Date(now - days * 86_400_000).toISOString(),
        releaseVerification
      })
    );
    await writeFile(path.join(directory, 'result.log'), 'test result');
    return directory;
  };
  return { workspace, root, run };
};
afterEach(async () => {
  for (const workspace of workspaces.splice(0)) {
    const resolved = path.resolve(workspace);
    if (
      path.dirname(resolved) !== path.resolve(tmpdir()) ||
      !path.basename(resolved).startsWith('sandshark-retention-test-')
    )
      throw new Error('Invalid test workspace');
    await rm(resolved, { recursive: true, force: true });
  }
});
test('dry-run changes nothing; apply is limited by count, age and delete cap', async () => {
  const { workspace, run } = await setup();
  await run('new', 1);
  await run('recent', 10);
  const old = await run('old', 30);
  const oldest = await run('oldest', 40);
  const options = { now, keep: 1, maxAgeDays: 14, maxDeletes: 1 };
  const plan = await pruneTestArtifacts(workspace, options);
  expect(
    plan.filter((entry) => entry.action === 'delete').map((entry) => entry.name)
  ).toEqual(['old']);
  await access(path.join(old, 'result.log'));
  const applied = await pruneTestArtifacts(workspace, {
    ...options,
    apply: true
  });
  expect(applied.filter((entry) => entry.action === 'deleted')).toHaveLength(1);
  await expect(access(old)).rejects.toThrow();
  await access(oldest);
});
test('pending release evidence, unmarked runs and protected data are never removed', async () => {
  const { workspace, root, run } = await setup();
  await run('recent', 1);
  await run('release-evidence', 60, 'pending');
  const protectedRun = await run('protected', 60);
  await writeFile(path.join(protectedRun, '.keep'), 'pending verification');
  const dataRun = await run('data-copy', 60);
  await mkdir(path.join(dataRun, 'data'));
  await writeFile(path.join(dataRun, 'data/db.sqlite'), 'preserve');
  const unmarked = path.join(root, 'unmarked');
  await mkdir(unmarked);
  await writeFile(path.join(unmarked, 'run.json'), '{bad');
  const backup = path.join(workspace, '.integration/development-backup');
  await mkdir(backup, { recursive: true });
  await writeFile(path.join(backup, 'db.sqlite'), 'backup');
  const plan = await pruneTestArtifacts(workspace, {
    now,
    keep: 1,
    apply: true
  });
  expect(plan.every((entry) => entry.action !== 'deleted')).toBe(true);
  await access(path.join(backup, 'db.sqlite'));
  await access(path.join(dataRun, 'data/db.sqlite'));
});
test('links cannot redirect deletion outside the managed run directory', async () => {
  const { workspace, root, run } = await setup();
  await run('recent', 1);
  const outside = path.join(workspace, 'backup');
  await mkdir(outside);
  await writeFile(path.join(outside, 'keep.txt'), 'preserve');
  await symlink(
    outside,
    path.join(root, 'linked'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );
  const plan = await pruneTestArtifacts(workspace, {
    now,
    keep: 1,
    apply: true
  });
  expect(plan.find((entry) => entry.name === 'linked')?.action).toBe(
    'preserve'
  );
  await access(path.join(outside, 'keep.txt'));
});
test('rejects linked artifact roots and invalid retention limits', async () => {
  const { workspace, root } = await setup();
  await expect(pruneTestArtifacts(workspace, { keep: 0 })).rejects.toThrow(
    'Invalid keep'
  );
  const linkedWorkspace = path.join(workspace, 'linked-workspace');
  await mkdir(linkedWorkspace);
  await symlink(
    path.dirname(root),
    path.join(linkedWorkspace, '.artifacts'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );
  await expect(pruneTestArtifacts(linkedWorkspace)).rejects.toThrow(
    'Artifact root must not be a link.'
  );
});
