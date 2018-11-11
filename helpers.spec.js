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

  describe('replaceObjects', () => {
    test('replaces objects with array of touples', () => {
      const obj = { a: 5, b: 6 };
      expect(JSON.stringify(obj, helpers.replaceObjects)).toEqual('[["a",5],["b",6]]');
    });

    test('array is sorted by key names', () => {
      const obj = { b: 6, a: 5, c: 8 };
      expect(JSON.stringify(obj, helpers.replaceObjects)).toEqual('[["a",5],["b",6],["c",8]]');
    });

    test('handle recursive objects', () => {
      const obj = { b: 6, a: { c: { d: 1, e: 2 } } };
      expect(JSON.stringify(obj, helpers.replaceObjects)).toEqual(
        '[["a",[["c",[["d",1],["e",2]]]]],["b",6]]'
      );
    });
  });

  describe('stringify', () => {
    test('args array to hash', () => {
      const args = [{ b: 6, a: { c: { d: 1, e: 2 } } }, () => {}];
      expect(helpers.stringify(args)).toBe('73fc54e0698fea35fe2c121cbd2cbbef');
    });
  });
});
