/* eslint-disable import/no-extraneous-dependencies, no-console */
const redis = require('redis');
const async = require('async');
const ms = require('ms');
const { createCache, RedisStorage } = require('../');

const redisClient = redis.createClient('redis://localhost:6379');
const redisCache = createCache({
  prefix: '__CACHE__',
  storage: new RedisStorage(redisClient),
  ttl: ms('1h'),
});

redisCache.on('error', err => {
  console.error(err);
  process.exit(1);
});

redisClient.on('error', err => {
  console.error(err);
  process.exit(1);
});

function getRandomNumber(number, next) {
  process.nextTick(() => {
    next(null, number);
  });
}

function main(next) {
  const { cache } = redisCache.register(getRandomNumber, { key: 'example:getRandomNumber' });

  const inputs = Array.from({ length: 1 }).map(() => Math.random());
  console.log(inputs);
  async.each(inputs, cache, next);
}

main(err => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});
