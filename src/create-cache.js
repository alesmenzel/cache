// @ts-nocheck
const debug = require('debug')('cache:create-cache');

const { md5, filepath, stringify } = require('./helpers');

/**
 * Create cache service
 *
 * @param {Object} options Cache options
 */
const createCache = (options = {}) => {
  const { storage } = options;

  return (fnc, overrides = {}) => {
    const {
      prefix, // Storage key prefix
      key, // Unique key identifying a function
      ttl = 60 * 60, // 60 minutes
      precache = -1, // Disabled by default
      hash = stringify, // Function to resolve function arguments into unique key
      timeout = -1, // Disabled by default
    } = { ...options, ...overrides };

    if (!storage) {
      throw new Error('You must specify a storage option.');
    }

    const keyId = key || md5(filepath(new Error().stack));
    const functionId = prefix ? `${prefix}:${keyId}` : keyId;

    /**
     * Return cache
     *
     * @param  {any[]} args Arguments
     */
    const cache = (...args) => {
      const newArgs = args.slice(0, -1);
      const next = args[args.length - 1];
      const argsId = hash(args);
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

        if (!data) {
          debug('Calling the original function');
          fnc(...newArgs, (err, ...data) => {
            if (err) {
              next(err);
              return;
            }

            storage.set(functionId, argsId, data, { ttl }, err => {
              if (err) {
                debug('Error while setting cache', err);
              }
            });

            // Skip waiting for setting the cache
            next(null, ...data);
          });
          return;
        }

        if (precache !== -1 && timeLeft <= precache) {
          debug('Calling the original function (Precache)');
          fnc(...newArgs, (err, ...data) => {
            if (err) {
              debug('Precache returned an error', err);
              return;
            }

            // We ignore the error and callback on purpose
            storage.set(functionId, argsId, data, { ttl }, err => {
              if (err) {
                debug('Error while setting cache', err);
              }
            });
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
        }, timeout * 1000);
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
