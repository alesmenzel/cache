// @ts-nocheck
const createCache = require('./create-cache');

describe('create-cache', () => {
  test('throw error if no storage is set', () => {
    expect(createCache()).toThrow();
  });

  test('returns correct data when cache is empty', next => {
    const fakeStorage = {
      get(funcId, argsId, next) {
        next();
      },
      set(funcId, argsId, data, options, next) {
        next();
      },
    };

    const register = createCache({ storage: fakeStorage });

    const fnc = (a, b, c, next) => {
      setTimeout(() => {
        next(null, a, b, c);
      }, 0);
    };

    const { cache } = register(fnc);
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
      get(funcId, argsId, next) {
        next(null, [1, 'data', [1, 'item', { key: 'value' }]]);
      },
      set(funcId, argsId, data, options, next) {
        next();
      },
    };

    const register = createCache({ storage: fakeStorage });

    const fnc = (a, b, c, next) => {
      setTimeout(() => {
        next(null, a, b, c);
      }, 0);
    };

    const { cache } = register(fnc);
    cache(1, 'data', [1, 'item', { key: 'value' }], (err, a, b, c) => {
      expect(err).toBe(null);
      expect(a).toBe(1);
      expect(b).toBe('data');
      expect(c).toEqual([1, 'item', { key: 'value' }]);
      next();
    });
  });
});
