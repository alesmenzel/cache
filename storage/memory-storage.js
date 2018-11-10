const debug = require('debug')('cache:storage:memory');

class MemoryStorage {
  constructor() {
    this.memory = new Map();
  }

  /**
   * Return cache and current ttl from storage
   *
   * @param {String} funcId Unique identification of function
   * @param {String} argsId Unique identification of arguments
   * @param {Function} next Callback
   */
  get(funcId, argsId, next) {
    debug('Getting cache for', funcId, argsId);
    const result = this.memory.get(`${funcId}:${argsId}`);

    if (!result) {
      next();
      return;
    }

    const { data, ttl, added } = result;
    const time = ttl - (Date.now() - added) / 1000;
    next(null, data, time);
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
    debug('Setting cache for', funcId, argsId, data, options);
    const result = this.memory.get(`${funcId}:${argsId}`);

    if (result) {
      clearTimeout(result.timeout);
    }

    const newTimeout = setTimeout(() => {
      this.memory.delete(`${funcId}:${argsId}`);
    }, options.ttl * 1000);

    this.memory.set(`${funcId}:${argsId}`, {
      data,
      ttl: options.ttl,
      added: new Date(),
      timeout: newTimeout,
    });
    next();
  }

  /**
   * Delete cache for a function
   *
   * @param {String} funcId Unique identification of function
   * @param {Function} next Callback
   */
  delete(funcId, next) {
    debug('Deleting cache for', funcId);
    this.memory.forEach((_, key) => {
      if (key.match(new RegExp(`^${funcId}`))) {
        this.memory.delete(key);
      }
    });
    next();
  }
}

module.exports = MemoryStorage;
