import { parseArgs } from 'util';
import { patchServerVersion } from './helpers';

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    version: { type: 'string' }
  },
  strict: true,
  allowPositionals: true
});

if (!values.version) {
  console.error('Error: version is required.');
  process.exit(1);
}

console.log(`Setting version to ${values.version}...`);

await patchServerVersion(values.version);
