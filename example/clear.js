/* eslint-disable import/no-extraneous-dependencies, no-console */
const redis = require('redis');
const async = require('async');
const { createCache, RedisStorage } = require('../');

const redisClient = redis.createClient('redis://localhost:6379');
const storage = new RedisStorage(redisClient);
const Cache = createCache(storage, {
  prefix: '__CACHE__',
  ttl: '30min',
});

Cache.on('error', err => {
  console.error(err);
  process.exit(1);
});

redisClient.on('error', err => {
  console.error(err);
  process.exit(1);
});

const sampleFunction = (a, b, c, next) => {
  process.nextTick(() => {
    next(null, a, b, c);
  });
};

function main(next) {
  const { cache, clear } = Cache.register(sampleFunction);
  async.series(
    [
      next => cache(1, 2, 3, next),
      next => cache('a', 'b', 'c', next),
      next => cache('x', { y: 'z' }, ['abc'], next),
      next => clear(next),
    ],
    next
  );
}

main(err => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  process.exit(0);
});
