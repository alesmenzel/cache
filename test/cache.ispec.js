const ms = require('ms');
const async = require('async');
const redis = require('./redis-connection');

const { getKey } = require('../src/helpers');
const { createCache, RedisStorage } = require('../src');

const prefix = 'cache-qa';
const storage = new RedisStorage(redis);
const Cache = createCache(storage, {
  prefix,
  ttl: '1min',
});

/**
 * Sample expesive function that we will cache.
 * @param {Object} a
 * @param {Number} b
 * @param {Function} next Callback
 */
const expensiveAsyncFnc = (a, b, next) => {
  if (!Number.isFinite(a.value) || !Number.isFinite(b)) {
    next(new Error('a.value and b must be a number'));
    return;
  }
  process.nextTick(() => {
    next(null, a.value + b);
  });
};

const expensiveAsyncFncMock = jest.fn(expensiveAsyncFnc);

/**
 * Wait for a few seconds.
 * @param {string} time Time
 * @param {Function} next Callback
 */
const wait = (time, next) => setTimeout(next, ms(time));

describe('Set cache', () => {
  beforeEach(next => {
    expensiveAsyncFncMock.mockClear();
    redis.flushdb(next);
  });

  afterAll(next => {
    async.series(
      [
        next => redis.flushdb(next),
        next => {
          redis.quit();
          next();
        },
      ],
      next
    );
  });

  test('cache is stored in redis', next => {
    const funcKey = 'cache-test001';
    const argsKey = 'a256b64';
    const redisKey = getKey(prefix, funcKey, argsKey);
    const { cache } = Cache.register(expensiveAsyncFnc, { key: funcKey, hash: () => argsKey });
    async.series(
      [
        next => cache({ value: 256 }, 64, next),
        next =>
          redis.get(redisKey, (err, json) => {
            if (err) {
              next(err);
              return;
            }

            expect(json).toBe('[320]');
            next();
          }),
      ],
      next
    );
  });

  test('cache is returned', next => {
    const { cache } = Cache.register(expensiveAsyncFnc, { key: 'cache-test001' });
    cache({ value: 256 }, 64, (err, ...data) => {
      if (err) {
        next(err);
        return;
      }

      expect(data).toEqual([320]);
      next();
    });
  });

  test('cache is returned when precaching', next => {
    const { cache } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test001',
      ttl: '5s',
      precache: '2s',
    });
    async.series(
      [
        next => cache({ value: 256 }, 64, next),
        next => wait('3s', next),
        next =>
          cache({ value: 256 }, 64, (err, ...data) => {
            if (err) {
              next(err);
              return;
            }

            expect(data).toEqual([320]);
            next();
          }),
      ],
      next
    );
    cache({ value: 256 }, 64, (err, ...data) => {
      if (err) {
        next(err);
        return;
      }

      expect(data).toEqual([320]);
      next();
    });
  });

  test('cache is not stored in redis if original function returns error', next => {
    const funcKey = 'cache-test001';
    const argsKey = 'a256b64';
    const redisKey = getKey(prefix, funcKey, argsKey);
    const { cache } = Cache.register(expensiveAsyncFnc, { key: funcKey, hash: () => argsKey });
    async.series(
      [
        next => cache({ value: 256 }, 64, next),
        next =>
          redis.get(redisKey, (err, json) => {
            if (err) {
              next(err);
              return;
            }

            expect(json).toBe('[320]');
            next();
          }),
      ],
      next
    );
  });

  test('original function is called once when setting cache', next => {
    const { cache } = Cache.register(expensiveAsyncFnc, { key: 'cache-test001' });
    async.series(
      [
        next => cache({ value: 'not-finite' }, 64, () => next()),
        next => {
          redis.keys(`${prefix}*`, (err, keys) => {
            if (err) {
              next(err);
              return;
            }

            expect(keys.length).toBe(0);
            next();
          });
        },
      ],
      next
    );
  });

  test('precache is set', next => {
    const funcKey = 'precache-test001';
    const argsKey = 'a256b64';
    const redisKey = getKey(prefix, funcKey, argsKey);
    const { cache } = Cache.register(expensiveAsyncFnc, {
      key: funcKey,
      hash: () => argsKey,
      ttl: '5s',
      precache: '2s',
    });
    async.series(
      [
        next => cache({ value: 256 }, 64, next),
        next => wait('3s', next),
        next => cache({ value: 256 }, 64, next),
        next =>
          redis.get(redisKey, (err, json) => {
            if (err) {
              next(err);
              return;
            }

            expect(json).toBe('[320]');
            next();
          }),
      ],
      next
    );
  });

  test('original function is called when precaching', next => {
    const { cache } = Cache.register(expensiveAsyncFncMock, {
      key: 'precache-test001',
      ttl: '5s',
      precache: '2s',
    });
    async.series(
      [
        next => cache({ value: 256 }, 64, next),
        next => wait('3s', next),
        next => cache({ value: 256 }, 64, next),
        next => {
          process.nextTick(() => {
            expect(expensiveAsyncFncMock.mock.calls.length).toBe(2);
            next();
          });
        },
      ],
      next
    );
  });

  test('stores cache for multiple keys in redis', next => {
    const { cache } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test001',
      ttl: '5s',
    });
    const { cache: cache2 } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test002',
      ttl: '5s',
    });
    async.series(
      [
        next => cache({ value: 64 }, 64, next),
        next => cache({ value: 128 }, 128, next),
        next => cache({ value: 256 }, 256, next),
        next => cache2({ value: 64 }, 64, next),
        next => cache2({ value: 128 }, 128, next),
        next => cache2({ value: 256 }, 256, next),
        next => {
          redis.keys(`${prefix}*`, (err, keys) => {
            if (err) {
              next(err);
              return;
            }

            expect(keys.length).toBe(6);
            next();
          });
        },
      ],
      next
    );
  });

  test('delete stored cache for a key', next => {
    const { cache, clear } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test001',
      ttl: '5s',
    });
    const { cache: cache2 } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test002',
      ttl: '5s',
    });
    async.series(
      [
        next => cache({ value: 64 }, 64, next),
        next => cache({ value: 128 }, 128, next),
        next => cache({ value: 256 }, 256, next),
        next => cache2({ value: 64 }, 64, next),
        next => cache2({ value: 128 }, 128, next),
        next => cache2({ value: 256 }, 256, next),
        next => clear(next),
        next => {
          redis.keys(`${prefix}:cache-test001*`, (err, keys) => {
            if (err) {
              next(err);
              return;
            }

            expect(keys.length).toBe(0);
            next();
          });
        },
      ],
      next
    );
  });

  test('delete stored cache and does not delete other keys', next => {
    const { cache, clear } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test001',
      ttl: '5s',
    });
    const { cache: cache2 } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test002',
      ttl: '5s',
    });
    async.series(
      [
        next => cache({ value: 64 }, 64, next),
        next => cache({ value: 128 }, 128, next),
        next => cache2({ value: 64 }, 64, next),
        next => cache2({ value: 128 }, 128, next),
        next => clear(next),
        next => {
          redis.keys(`${prefix}:cache-test002*`, (err, keys) => {
            if (err) {
              next(err);
              return;
            }

            expect(keys.length).toBe(2);
            next();
          });
        },
      ],
      next
    );
  });

  test('set single cache key in redis for the same input', next => {
    const { cache } = Cache.register(expensiveAsyncFncMock, { key: 'cache-test001' });
    async.series(
      [
        next => cache({ a: 64, b: 128, c: 256, value: 512 }, 64, next),
        next => cache({ value: 512, a: 64, b: 128, c: 256 }, 64, next),
        next => cache({ a: 64, b: 128, value: 512, c: 256 }, 64, next),
        next => {
          redis.keys(`${prefix}*`, (err, keys) => {
            if (err) {
              next(err);
              return;
            }

            expect(keys.length).toBe(1);
            next();
          });
        },
      ],
      next
    );
  });

  test('original function is called just once for same input', next => {
    const { cache } = Cache.register(expensiveAsyncFncMock, { key: 'cache-test001', ttl: '60s' });
    async.series(
      [
        next => cache({ a: 64, b: 128, c: 256, value: 512 }, 64, next),
        next => cache({ value: 512, a: 64, b: 128, c: 256 }, 64, next),
        next => cache({ a: 64, b: 128, value: 512, c: 256 }, 64, next),
        next => {
          expect(expensiveAsyncFncMock.mock.calls.length).toBe(1);
          next();
        },
      ],
      next
    );
  });

  test('purge cache clears all cache keys in redis', next => {
    const { cache } = Cache.register(expensiveAsyncFnc, { key: 'cache-test001', ttl: '60s' });
    const { cache: cache2 } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test002',
      ttl: '60s',
    });
    const { cache: cache3 } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test003',
      ttl: '60s',
    });
    async.series(
      [
        next => cache({ value: 128 }, 64, next),
        next => cache({ value: 256 }, 64, next),
        next => cache2({ value: 128 }, 64, next),
        next => cache2({ value: 256 }, 64, next),
        next => cache3({ value: 128 }, 64, next),
        next => cache3({ value: 256 }, 64, next),
        next => Cache.purge(next),
        next => {
          redis.keys(`${prefix}*`, (err, keys) => {
            if (err) {
              next(err);
              return;
            }

            expect(keys.length).toBe(0);
            next();
          });
        },
      ],
      next
    );
  });

  test('purge cache clears all cache keys in redis', next => {
    const { cache } = Cache.register(expensiveAsyncFnc, { key: 'cache-test001', ttl: '60s' });
    const { cache: cache2 } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test002',
      ttl: '60s',
    });
    const { cache: cache3 } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test003',
      ttl: '60s',
    });
    async.series(
      [
        next => cache({ value: 128 }, 64, next),
        next => cache({ value: 256 }, 64, next),
        next => cache2({ value: 128 }, 64, next),
        next => cache2({ value: 256 }, 64, next),
        next => cache3({ value: 128 }, 64, next),
        next => cache3({ value: 256 }, 64, next),
        next => Cache.purge(next),
        next => {
          redis.keys(`${prefix}*`, (err, keys) => {
            if (err) {
              next(err);
              return;
            }

            expect(keys.length).toBe(0);
            next();
          });
        },
      ],
      next
    );
  });

  test('purge does not clear other keys in redis', next => {
    async.series(
      [
        next => {
          redis.setex('my-key', 30, 'my-value', next);
        },
        next => Cache.purge(next),
        next => {
          redis.get('my-key', (err, data) => {
            if (err) {
              next(err);
              return;
            }

            expect(data).toBe('my-value');
            next();
          });
        },
      ],
      next
    );
  });
});
