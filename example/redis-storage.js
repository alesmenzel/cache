/* eslint-disable no-console */
const assert = require('assert');
const redis = require('redis');
const { createCache, RedisStorage } = require('../');

const client = redis.createClient('redis://localhost:6379');
const register = createCache({
  storage: new RedisStorage(client),
  ttl: 10,
  precache: 5,
  timeout: 200,
});

client.on('ready', () => {
  const fnc = (a, b, next) => {
    setTimeout(() => {
      next(null, a, b);
    }, 1);
  };

  const { cache } = register(fnc);

  cache(123456, { a: 'hello', b: 'world' }, (err, a, b) => {
    assert.equal(err, null);
    assert.deepEqual(a, 123456);
    assert.deepEqual(b, { a: 'hello', b: 'world' });

    cache(123456, { b: 'world', a: 'hello' }, (err, a, b) => {
      assert.equal(err, null);
      assert.deepEqual(a, 123456);
      assert.deepEqual(b, { a: 'hello', b: 'world' });

      cache(123456, { a: 'hello', b: 'world' }, (err, a, b) => {
        assert.equal(err, null);
        assert.deepEqual(a, 123456);
        assert.deepEqual(b, { a: 'hello', b: 'world' });

        process.exit(0);
      });
    });
  });
});

client.on('error', err => {
  console.error(err);
  process.exit(1);
});
