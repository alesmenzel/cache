const crypto = require('crypto');
const ms = require('ms');
const stringify = require('fast-json-stable-stringify');

/**
 * Get the current working directory
 */
const cwd = () => process.cwd();

/**
 * Non-operational function
 */
const noop = () => {};

/**
 * Create MD5 hash from a string
 *
 * @param {String} str String to hash
 */
const md5 = str =>
  crypto
    .createHash('md5')
    .update(str)
    .digest('hex');

/**
 * Get filepath from stack beginning from cwd
 *
 * @param {String} str Stack
 * @returns Filepath in the format of `/path/to/file.js:154:17`
 */
const filepath = str =>
  str
    .split('\n')[2]
    .match(/\((.*)\)/)[1] // Take "filepath:row:column"
    .replace(cwd(), '') // Cross-system
    .replace(/\\/g, '/'); // Cross-platform

/**
 * Stringify arguments into a unique key
 *
 * @param {Array} args Arguments
 */
const uniqueKey = args => md5(stringify(args));

/**
 * Convert input to seconds (e.g. '30s' -> 30 or '1h' -> 3600)
 *
 * @param {String|Number} time Time
 */
const toSeconds = time => {
  if (typeof time === 'string') {
    return Math.round(ms(time) / 1000);
  }

  return time;
};

/**
 * Return whether timeout is enabled
 *
 * @param {Number|null} timeout Timeout in seconds
 */
const isTimeoutEnabled = timeout => {
  if (!Number.isFinite(timeout)) {
    return false;
  }

  return timeout >= 0;
};

/**
 * Return whether precache is enabled
 *
 * @param {String|Number|null} ttl TTL
 */
const isPrecacheEnabled = ttl => {
  if (ttl === undefined || ttl === null) {
    return false;
  }

  if (typeof ttl === 'number') {
    return ttl >= 0;
  }

  return true;
};

/**
 * Return cache key
 *
 * @param {string} prefix
 * @param {string} funcId
 * @param {string} argsId
 */
const getKey = (prefix, funcId, argsId) => `${prefix}:${funcId}:${argsId}`;

module.exports = {
  cwd,
  noop,
  md5,
  filepath,
  uniqueKey,
  toSeconds,
  isTimeoutEnabled,
  isPrecacheEnabled,
  getKey,
};
