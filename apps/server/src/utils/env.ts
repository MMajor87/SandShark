// these values are injected at build time
const SANDSHARK_ENV = process.env.SANDSHARK_ENV;
const SANDSHARK_BUILD_VERSION = process.env.SANDSHARK_BUILD_VERSION;
const SANDSHARK_BUILD_DATE = process.env.SANDSHARK_BUILD_DATE;
const SANDSHARK_MEDIASOUP_BIN_NAME = process.env.SANDSHARK_MEDIASOUP_BIN_NAME;

const SERVER_VERSION =
  typeof SANDSHARK_BUILD_VERSION !== 'undefined'
    ? SANDSHARK_BUILD_VERSION
    : '0.0.0-dev';

const BUILD_DATE =
  typeof SANDSHARK_BUILD_DATE !== 'undefined' ? SANDSHARK_BUILD_DATE : 'dev';

const env =
  typeof SANDSHARK_ENV !== 'undefined' ? SANDSHARK_ENV : 'development';
const IS_PRODUCTION = env === 'production';
const IS_DEVELOPMENT = !IS_PRODUCTION;
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_DOCKER = process.env.RUNNING_IN_DOCKER === 'true';
// set by the unit that install-linux.sh writes
const IS_SYSTEMD_SERVICE = process.env.SANDSHARK_SERVICE === 'systemd';

if (IS_PRODUCTION) {
  if (!SANDSHARK_MEDIASOUP_BIN_NAME) {
    throw new Error('SANDSHARK_MEDIASOUP_BIN is not defined');
  }
}

export {
  BUILD_DATE,
  IS_DEVELOPMENT,
  IS_DOCKER,
  IS_PRODUCTION,
  IS_SYSTEMD_SERVICE,
  IS_TEST,
  SANDSHARK_MEDIASOUP_BIN_NAME,
  SERVER_VERSION
};
