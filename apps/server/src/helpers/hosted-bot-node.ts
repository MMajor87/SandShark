import { findBinary } from '../utils/find-binary';

const NODE_MISSING_MESSAGE =
  'This bot is set to run on Node.js, and Node.js 20 or newer was not found on this server.';

// 20 is the oldest release line that loads the shim with --import
const MIN_NODE_MAJOR = 20;

// bun answers to node too: `bun run` puts a node on the path that is bun itself when no
// node is installed, and it claims a recent node version. it cannot load the shim with
// --import, so it answers the probe with something that is not a version
const findNode = () =>
  findBinary(
    ['node'],
    [
      '-p',
      'typeof Bun === "undefined" ? process.versions.node.split(".")[0] : "bun"'
    ],
    (major) => Number(major) >= MIN_NODE_MAJOR
  );

export { findNode, NODE_MISSING_MESSAGE };
