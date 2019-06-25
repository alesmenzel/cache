/* eslint-disable import/no-extraneous-dependencies, no-console */
const redis = require('redis');
const async = require('async');
const { createCache, RedisStorage } = require('../');

const client = redis.createClient('redis://localhost:6379');
const redisCache = createCache({
  prefix: '__CACHE__',
  storage: new RedisStorage(redis),
  ttl: 30, // seconds (defaults to 60 minutes)
  precache: 15, // seconds (time remaining), set to -1 to disable (defaults to -1)
  timeout: 0.5, // seconds
});

redisCache.on('error', err => {
  console.log(err);
});

client.on('ready', () => {
  const wait = (ms, next) => setTimeout(next, ms);

  // Expensive function we want to cache
  const myCostlyFunction = (a, b, next) => {
    wait(3000, () => {
      next(null, Math.random(), { something: 'some-content' });
    });
  };

  const { cache, clear } = redisCache.register(myCostlyFunction, {
    ttl: 10,
    precache: 5,
    key: '_MYFUNCTION_',
  });

  const cacheProxy = (...args) => {
    const params = args.slice(0, -1);
    const [next] = args.slice(-1);
    cache(...params, (err, ...output) => {
      console.log('Cache returned data', JSON.stringify(output));
      next(err, ...output);
    });
  };

  const a = [123, ['abc']];
  const b = { a: 1, b: 2, c: 3 };

  console.log('Starting test');

  async.series(
    [
      next => cacheProxy(a, b, next), // fetch (3s)
      next => cacheProxy(a, b, next), // cache
      next => cacheProxy(a, b, next), // cache
      next => wait(1000, next), // 1s (4s)
      next => cacheProxy(a, b, next), // cache
      next => cacheProxy(a, b, next), // cache
      next => cacheProxy(a, b, next), // cache
      next => wait(4500, next), // 4.5s (8.5s)
      next => cacheProxy(a, b, next), // cache / fetch precache (3s)
      next => cacheProxy(a, b, next), // cache
      next => cacheProxy(a, b, next), // cache
      next => wait(2000, next), // 2s (10.5s)
      next => cacheProxy(a, b, next), // wait
      next => cacheProxy(a, b, next), // wait
      next => cacheProxy(a, b, next), // wait
      next => wait(2000, next), // 2s (12.5s)
      next => clear(next),
    ],
    () => {
      console.log('Done!');
      process.exit(0);
    }
  );
});

client.on('error', err => {
  console.error(err);
  process.exit(1);
});
