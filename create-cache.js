// @ts-nocheck
const debug = require('debug')('cache:create-cache');
const crypto = require('crypto');

const cwd = process.cwd();

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
    .replace(cwd, '') // Cross-system
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
        const keyB = b[1].toUpperCase();

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
const stringify = args => md5(JSON.stringify(args, replaceObjects));

/**
 * Create cache service
 *
 * @param {Object} options Cache options
 */
const createCache = (options = {}) => {
  const { storage } = options;
  const queue = new Set();

  return (fnc, overrides = {}) => {
    const {
      key,
      ttl = 60 * 60, // 60 minutes
      precache = -1, // Disabled by default
      hash = md5,
      resolve = stringify,
    } = { ...options, ...overrides };

    if (!storage) {
      throw new Error('You must specify a storage option.');
    }

    let functionId;
    if (key) {
      functionId = key;
    } else {
      functionId = hash(filepath(new Error().stack));
    }

    /**
     * Return cache
     *
     * @param  {any[]} args Arguments
     */
    const cache = (...args) => {
      const newArgs = args.slice(0, args.length - 1);
      const next = args[args.length - 1];
      const argsId = resolve(args);

      storage.get(functionId, argsId, (err, data, timeLeft) => {
        if (err) {
          next(err);
          return;
        }

        debug('Ret:', data, timeLeft);
        if (!data) {
          debug('Caching');
          fnc(...newArgs, (err, ...data) => {
            if (err) {
              next(err);
              return;
            }

            // We ignore the callback on purpose
            storage.set(functionId, argsId, data, { ttl }, noop);
            // Dont wait for it to set the value
            next(null, ...data);
          });
          return;
        }

        if (precache !== -1 && timeLeft <= precache) {
          const uniqueId = `${functionId}:${argsId}`;

          if (queue.has(uniqueId)) {
            next(null, data);
            return;
          }

          queue.add(uniqueId);
          debug('Precaching');
          fnc(...newArgs, (err, ...data) => {
            queue.delete(uniqueId);
            if (err) {
              next(err);
              return;
            }

            // We ignore the callback on purpose
            storage.set(functionId, argsId, data, { ttl }, noop);
          });

          // Dont wait for the fnc to finish
          next(null, ...data);
          return;
        }

        debug('Returning cache');
        next(null, ...data);
      });
    };

    /**
     * Clear cache for the function
     *
     * @param {Function} next Callback
     */
    const clear = next => storage.delete(functionId, next);

    return { cache, clear };
  };
};

module.exports = createCache;
