// @ts-nocheck
const debug = require('debug')('cache:create-cache');

const { noop, md5, filepath, stringify } = require('./helpers');

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
      timeout = -1, // Disabled by default
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
      let timeoutId = null;

      const callback = (err, data, timeLeft) => {
        if (timeout !== -1 && !timeoutId) {
          return;
        }

        clearTimeout(timeoutId);
        timeoutId = null;

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
      };

      if (timeout !== -1) {
        timeoutId = setTimeout(() => {
          debug('Timeouted');
          callback();
        }, timeout);
      }
      storage.get(functionId, argsId, callback);
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