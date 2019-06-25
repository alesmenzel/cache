const createCache = require('./create-cache');

describe('create-cache', () => {
  test('throw error if no storage is set', () => {
    expect(() => createCache()).toThrow();
  });

  test('returns correct data when cache is empty', next => {
    const fakeStorage = {
      constructor: {
        name: 'FakeStorage',
      },
      get(funcId, argsId, options, next) {
        next();
      },
      set(funcId, argsId, data, options, next) {
        next();
      },
    };

    const Cache = createCache(fakeStorage);

    const fnc = (a, b, c, next) => {
      setTimeout(() => {
        next(null, a, b, c);
      }, 0);
    };

    const { cache } = Cache.register(fnc);
    cache(1, 'data', [1, 'item', { key: 'value' }], (err, a, b, c) => {
      expect(err).toBe(null);
      expect(a).toBe(1);
      expect(b).toBe('data');
      expect(c).toEqual([1, 'item', { key: 'value' }]);
      next();
    });
  });

  test('returns correct data when cache is hot', next => {
    const fakeStorage = {
      constructor: {
        name: 'FakeStorage',
      },
      get(funcId, argsId, options, next) {
        next(null, [1, 'data', [1, 'item', { key: 'value' }]]);
      },
      set(funcId, argsId, data, options, next) {
        next();
      },
    };

    const Cache = createCache(fakeStorage);

    const fnc = (a, b, c, next) => {
      setTimeout(() => {
        next(null, a, b, c);
      }, 0);
    };

    const { cache } = Cache.register(fnc);
    cache(1, 'data', [1, 'item', { key: 'value' }], (err, a, b, c) => {
      expect(err).toBe(null);
      expect(a).toBe(1);
      expect(b).toBe('data');
      expect(c).toEqual([1, 'item', { key: 'value' }]);
      next();
    });
  });
});
