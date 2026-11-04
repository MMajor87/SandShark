import { findBinary } from '../utils/find-binary';

const NODE_MISSING_MESSAGE =
  'This bot is set to run on Node.js, and Node.js 20 or newer was not found on this server.';

// 20 is the oldest release line that loads the shim with --import
const MIN_NODE_MAJOR = 20;

const findNode = () =>
  findBinary(
    ['node'],
    ['-p', 'process.versions.node.split(".")[0]'],
    (major) => Number(major) >= MIN_NODE_MAJOR
  );

export { findNode, NODE_MISSING_MESSAGE };
