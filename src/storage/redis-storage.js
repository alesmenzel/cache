const debug = require('debug')('cache:storage:redis');
const async = require('async');

class RedisStorage {
  /**
   * Create redis storage.
   * @param {RedisClient} client - Redis client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Do a recursive scan iteration.
   * @param {(number|null)} cursor - Scan cursor
   * @param {Object} [options] - Scan options
   * @param {string} [options.pattern] - Match pattern
   * @param {string} [options.count] - Scan count
   * @param {string} [options.onIteration] - Hook after each scan
   * @param {string[]} keys - Keys
   * @param {Function} next - Callback
   */
  scanIteration(cursor, options = {}, keys, next) {
    const { pattern, count = 200, onIteration } = options;
    if (cursor === '0') {
      debug(`Scan finished, found ${keys.length} key(s)`);
      next(null, keys);
      return;
    }
    debug(`Scanning cursor '${cursor}' for pattern '${pattern}, count: ${count} per iteration'`);
    this.client.scan(cursor, 'match', pattern, 'count', count, (err, data) => {
      if (err) {
        debug('Scan error', err);
        next(err);
        return;
      }

      const [newCursor, fetchedKeys] = data;
      debug(`Scan found ${fetchedKeys.length} key(s)`);
      if (onIteration && fetchedKeys.length) {
        async.series(
          [
            next => {
              onIteration(fetchedKeys, next);
            },
            next => {
              this.scanIteration(newCursor, options, [...keys, ...fetchedKeys], next);
            },
          ],
          next
        );
        return;
      }

      this.scanIteration(newCursor, options, [...keys, ...fetchedKeys], next);
    });
  }

  /**
   * Perform a scan.
   * @param {Object} [options] - Scan options
   * @param {string} [options.pattern] - Match pattern
   * @param {number} [options.count=200] - Scan count
   * @param {number} [options.onIteration] - Hook after each iteration
   * @param {Function} next - Callback
   */
  scan(options = {}, next) {
    const { count = 200 } = options;
    this.scanIteration(0, { ...options, count }, [], next);
  }

  /**
   * Return cache and current ttl from storage.
   * @param {String} funcId - Unique identification of function
   * @param {String} argsId - Unique identification of arguments
   * @param {Object} options - Cache options
   * @param {Function} next - Callback
   */
  get(funcId, argsId, options, next) {
    const { prefix } = options;
    const key = `${prefix}:${funcId}:${argsId}`;
    debug(`Retrieving cache and ttl for %s`, key);
    async.parallel(
      {
        cache: next => {
          this.client.get(key, next);
        },
        ttl: next => {
          this.client.ttl(key, next);
        },
      },
      (err, data) => {
        if (err) {
          next(err);
          return;
        }

        const { cache, ttl } = data;
        if (!cache) {
          debug('Miss for %s', key);
          next();
          return;
        }

        debug('Hit for %s, data: %s', key, cache);
        let parsed;
        try {
          parsed = JSON.parse(cache);
        } catch (err) {
          debug('Invalid format', err);
          next(err);
          return;
        }

        if (!parsed || !Array.isArray(parsed)) {
          debug('Invalid response format, must be an array, %o', parsed);
          next(new Error('Invalid response from cache'));
          return;
        }

        next(null, parsed, ttl);
      }
    );
  }

  /**
   * Set cache under unique key and set its ttl.
   * @param {String} funcId - Unique identification of function
   * @param {String} argsId - Unique identification of arguments
   * @param {*} data - Data to store
   * @param {Object} options - Options like ttl
   * @param {Function} next - Callback
   */
  set(funcId, argsId, data, options, next) {
    const { ttl, prefix } = options;
    const json = JSON.stringify(data);
    const key = `${prefix}:${funcId}:${argsId}`;
    debug(`Setting cache for %s, options: %o, data: %s`, key, options, json);
    this.client.set(key, json, 'EX', ttl, err => {
      if (err) {
        next(err);
        return;
      }

      debug('Cache set for %s', key);
      next();
    });
  }

  /**
   * Delete cache for a function.
   * @param {String} funcId - Unique identification of a function
   * @param {Object} options - Cache options
   * @param {Function} next - Callback
   */
  delete(funcId, options, next) {
    const { prefix } = options;
    const pattern = `${prefix}:${funcId}:*`;
    debug(`Deleting cache for '%s'`, pattern);
    const params = {
      pattern,
      count: 200,
      onIteration: (keys, next) => {
        debug(`Iteration: %d key(s)`, keys.length);
        this.client.del(keys, err => next(err));
      },
    };
    this.scan(params, next);
  }

  /**
   * Purge all cached keys
   * (Be careful when not using any prefix as it will drop all keys)
   *
   * @param {Object} options Cache options
   * @param {Function} next Callback
   */
  purge(options, next) {
    const { prefix } = options;
    const pattern = `${prefix}:*`;
    debug(`Purging cache for '%s'`, pattern);
    const params = {
      pattern,
      count: 200,
      onIteration: (keys, next) => {
        debug(`Iteration: %d key(s)`, keys.length);
        this.client.del(keys, err => next(err));
      },
    };
    this.scan(params, next);
  }
}

module.exports = RedisStorage;
