const debug = require('debug')('cache:create-cache');
const EventEmitter = require('events');

const {
  md5,
  filepath,
  uniqueKey,
  toSeconds,
  isTimeoutEnabled,
  isPrecacheEnabled,
} = require('./helpers');

class Cache extends EventEmitter {
  /**
   * Create a cache.
   * @param {Storage} storage Storage
   * @param {Object} [options] Cache options
   */
  constructor(storage, options = {}) {
    super();
    if (!storage) {
      throw new Error('You must specify a storage');
    }
    this.storage = storage;
    this.options = options;
  }

  /**
   * Register an async callback function to cache.
   * @param {Function} fnc Function to cache (last param must be a callback)
   * @param {Object} [overrides] Override global cache options
   */
  register(fnc, overrides = {}) {
    if (!fnc || typeof fnc !== 'function') {
      throw new Error('First parameter to register must be a function');
    }

    const {
      prefix = 'cache:', // Storage key prefix
      key, // Unique key identifying a function
      hash = uniqueKey, // Function to resolve function arguments into unique key
    } = { ...this.options, ...overrides };
    let {
      ttl = 60 * 60, // 60 minutes
      precache = null, // Disabled by default
      timeout = null, // Disabled by default
    } = { ...this.options, ...overrides };

    ttl = toSeconds(ttl);
    precache = toSeconds(precache);
    timeout = toSeconds(timeout);

    const functionId = key || md5(filepath(new Error().stack));

    debug(`Registering a function %o`, { prefix, functionId, ttl, precache, timeout });

    /**
     * Return the cached function
     *
     * @param {...any} args Original function´s arguments
     */
    const cache = (...args) => {
      const params = args.slice(0, -1);
      const next = args[args.length - 1];

      if (!next || typeof next !== 'function') {
        throw new Error('Last parameter to cache function must be a callback');
      }

      const argsId = hash(params);
      let timeoutId = null;

      const callback = (err, data, timeLeft) => {
        if (isTimeoutEnabled(timeout) && !timeoutId) {
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
          fnc(...params, (err, ...data) => {
            if (err) {
              next(err);
              return;
            }

            this.storage.set(functionId, argsId, data, { prefix, ttl }, err => {
              if (err) {
                debug('Error while setting cache', err);
                this.emit('error', err);
              }
            });

            // Skip waiting for setting the cache
            next(null, ...data);
          });
          return;
        }

        debug('Should precache, %o', { ttl, precache, timeLeft });
        if (isPrecacheEnabled(precache) && ttl - timeLeft >= precache) {
          process.nextTick(() => {
            debug('Calling the original function (Precache)');
            fnc(...params, (err, ...data) => {
              if (err) {
                debug('Precache returned an error', err);
                this.emit('error', err);
                return;
              }

              this.storage.set(functionId, argsId, data, { prefix, ttl }, err => {
                if (err) {
                  debug('Error while setting cache', err);
                  this.emit('error', err);
                }
              });
            });
          });
          // Let fall through
        }

        debug('Returning cache');
        next(null, ...data);
      };

      if (isTimeoutEnabled(timeout)) {
        timeoutId = setTimeout(() => {
          debug('Timeouted');
          callback();
        }, timeout * 1000);
      }
      this.storage.get(functionId, argsId, { prefix }, callback);
    };

    /**
     * Clear cache for the function.
     * @param {Function} next Callback
     */
    const clear = next => this.storage.delete(functionId, { prefix }, next);

    return { cache, clear };
  }

  /**
   * Clear cache for a single function.
   * @param {String} functionId Function ID
   * @param {Function} next Callback
   */
  clear(functionId, next) {
    const { prefix } = this.options;
    this.storage.delete(functionId, { prefix }, next);
  }

  /**
   * Purge the whole cache.
   * @param {Function} next Callback
   */
  purge(next) {
    const { prefix } = this.options;
    this.storage.purge({ prefix }, next);
  }
}

module.exports = Cache;
