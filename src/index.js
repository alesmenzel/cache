const RedisStorage = require('./storage/redis-storage');
const createCache = require('./create-cache');

module.exports = { createCache, RedisStorage };
