const MemoryStorage = require('./storage/memory-storage');
const RedisStorage = require('./storage/redis-storage');
const createCache = require('./create-cache');

module.exports = { createCache, MemoryStorage, RedisStorage };
