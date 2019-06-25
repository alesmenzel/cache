const debug = require('debug')('cache:create-cache');

const Cache = require('./cache');

/**
 * Create cache service.
 * @param {Storage} storage Storage
 * @param {Object} [options] Cache options
 */
const createCache = (storage, options = {}) => {
  if (!storage) {
    throw new Error('You must specify a storage');
  }

  debug(`Creating new cache, storage: ${storage.constructor.name}, options:`, options);
  return new Cache(storage, options);
};

module.exports = createCache;
