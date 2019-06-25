const ms = require('ms');
const async = require('async');
const redis = require('./redis-connection');

const { createCache, RedisStorage } = require('../src');

const prefix = 'cache-qa';
const storage = new RedisStorage(redis);
const Cache = createCache(storage, {
  prefix,
  ttl: '1min',
});

const origStorageSet = Cache.storage.set;

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

  if (a.throw) {
    next(new Error(a.throw));
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
    Cache.storage.set = origStorageSet;
    Cache.removeAllListeners('error');
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

  test('error is emited when original function returns error when precaching', next => {
    const { cache } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test001',
      hash: () => '',
      ttl: '5s',
      precache: '1s',
    });
    Cache.on('error', err => {
      expect(err.message).toBe('Precache failed');
      next();
    });
    async.series(
      [
        next => cache({ value: 256 }, 64, next),
        next => wait('2s', next),
        // We use a predefined argsKey - we can have different arguments
        next => cache({ value: 256, throw: 'Precache failed' }, 64, next),
      ],
      // noop
      () => {}
    );
  });

  test('error is emited when storage could not set cache', next => {
    Cache.storage.set = jest.fn((funcId, argsId, data, options, next) => {
      next(new Error('Could not set cache'));
    });
    const { cache } = Cache.register(expensiveAsyncFnc, {
      key: 'cache-test001',
      ttl: '5s',
      precache: '2s',
    });
    Cache.on('error', err => {
      expect(err.message).toBe('Could not set cache');
      next();
    });
    async.series(
      [next => cache({ value: 256 }, 64, next)],
      // noop
      () => {}
    );
  });
});
