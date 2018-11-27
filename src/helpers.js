const crypto = require('crypto');

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
 * Replace objects as array touples because objects key order is not guaranteed
 * which could potentially cause different unique arguments keys
 *
 * @param {String} key Key
 * @param {*} value Value
 */
const replaceObjects = (key, value) => {
  if (value && !Array.isArray(value) && typeof value === 'object') {
    return Object.keys(value)
      .map(key => [key, value[key]])
      .sort((a, b) => {
        const keyA = a[0].toUpperCase();
        const keyB = b[0].toUpperCase();

        if (keyA < keyB) {
          return -1;
        }

        if (keyA > keyB) {
          return 1;
        }

        return 0;
      });
  }

  return value;
};

/**
 * Stringify arguments into a unique key
 *
 * @param {Array} args Arguments
 */
const stringify = args => md5(JSON.stringify(args.slice(0, args.length - 1), replaceObjects));

module.exports = { cwd, noop, md5, filepath, replaceObjects, stringify };
