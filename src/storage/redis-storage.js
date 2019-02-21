const debug = require('debug')('cache:storage:redis');

class RedisStorage {
  constructor(client) {
    this.client = client;
  }

  /**
   * Return cache and current ttl from storage
   *
   * @param {String} funcId Unique identification of function
   * @param {String} argsId Unique identification of arguments
   * @param {Function} next Callback
   */
  get(funcId, argsId, next) {
    debug(`Getting cache for ${funcId}:${argsId}`);
    this.client.get(`${funcId}:${argsId}`, (err, data) => {
      if (err) {
        next(err);
        return;
      }

      if (!data) {
        debug('Miss');
        next();
        return;
      }

      debug('Hit', data);
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (err) {
        debug('Invalid format', err);
        next(err);
        return;
      }

      if (!parsed || !Array.isArray(parsed)) {
        debug('Invalid response', parsed);
        next(new Error('Invalid response'));
        return;
      }

      debug(`Getting TTL for ${funcId}:${argsId}`);
      this.client.ttl(`${funcId}:${argsId}`, (err, ttl) => {
        if (err) {
          next(err);
          return;
        }

        debug('TTL returned');
        next(null, parsed, ttl);
      });
    });
  }

  /**
   * Set cache under unique key and set its ttl
   *
   * @param {String} funcId Unique identification of function
   * @param {String} argsId Unique identification of arguments
   * @param {*} data Data to store
   * @param {Object} options Options like ttl
   * @param {Function} next Callback
   */
  set(funcId, argsId, data, options, next) {
    debug(`Setting cache for ${funcId}:${argsId}`, JSON.stringify({ data, options }));
    this.client.set(`${funcId}:${argsId}`, JSON.stringify(data), 'EX', options.ttl, err => {
      if (err) {
        next(err);
        return;
      }

      debug('Cache set');
      next();
    });
  }

  /**
   * Delete cache for a function
   *
   * @param {String} funcId Unique identification of function
   * @param {Function} next Callback
   */
  delete(funcId, next) {
    debug(`Deleting cache for ${funcId}:*`);
    this.client.keys(`${funcId}*`, (err, keys) => {
      if (err) {
        next(err);
        return;
      }

      if (!keys.length) {
        debug('No keys found for deletion');
        next();
        return;
      }

      debug(`Deleting ${keys.length} key(s)`, JSON.stringify(keys));
      this.client.del(keys, err => {
        if (err) {
          next(err);
          return;
        }

        debug('Keys deleted');
        next();
      });
    });
  }
}

module.exports = RedisStorage;
