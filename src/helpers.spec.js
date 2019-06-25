const helpers = require('./helpers');

describe('helpers', () => {
  describe('md5', () => {
    test('correctly hashes string', () => {
      expect(helpers.md5('test-string')).toBe('661f8009fa8e56a9d0e94a0a644397d7');
    });

    test('correctly hashes empty string', () => {
      expect(helpers.md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    });

    test('correctly hashes path', () => {
      expect(helpers.md5('/path/to/file.js:185:16')).toBe('63aaf9d901734d073afb29f143066c6d');
    });
  });

  describe('filepath', () => {
    const { cwd } = process;

    describe('unix', () => {
      beforeEach(() => {
        process.cwd = () => '/path/to';
      });

      afterEach(() => {
        process.cwd = cwd;
      });

      test('correctly hashes path', () => {
        const stack = `\
  Error
      at /path/to/cache/create-cache.js:33:19
      at Object.test (/path/to/file.js:250:25)`;
        expect(helpers.filepath(stack)).toBe('/file.js:250:25');
      });
    });

    describe('windows', () => {
      beforeEach(() => {
        process.cwd = () => 'C:\\path\\to';
      });

      afterEach(() => {
        process.cwd = cwd;
      });

      test('correctly hashes path cross platform', () => {
        const stack = `\
  Error
      at C:\\path\\to\\cache\\create-cache.js:33:19
      at Object.test (C:\\path\\to\\file.js:250:25)`;
        expect(helpers.filepath(stack)).toBe('/file.js:250:25');
      });
    });
  });

  describe('uniqueKey', () => {
    test('args array to hash', () => {
      const args = [{ b: 6, a: { c: { d: 1, e: 2 } } }];
      expect(helpers.uniqueKey(args)).toBe('7eeed4eff6e9324286063e41bf27189e');
    });
  });

  describe('isTimeoutEnabled', () => {
    test('timeout is null', () => {
      expect(helpers.isTimeoutEnabled(null)).toBe(false);
    });

    test('timeout is a number', () => {
      expect(helpers.isTimeoutEnabled(2000)).toBe(true);
    });
  });

  describe('getKey', () => {
    test('return key', () => {
      expect(helpers.getKey('a', 'b', 'c')).toBe('a:b:c');
    });
  });
});
