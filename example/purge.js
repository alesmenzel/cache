/* eslint-disable import/no-extraneous-dependencies, no-console */
const redis = require('redis');
const { createCache, RedisStorage } = require('../');

const redisClient = redis.createClient('redis://localhost:6379');
const redisCache = createCache({
  prefix: '__CACHE__',
  storage: new RedisStorage(redisClient),
  ttl: 30,
});

redisCache.on('error', err => {
  console.error(err);
  process.exit(1);
});

redisClient.on('error', err => {
  console.error(err);
  process.exit(1);
});

function main(next) {
  redisCache.purge(next);
}

main(err => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  process.exit(0);
});
