# 🎲 Cache [![npm version](https://badge.fury.io/js/%40alesmenzel%2Fcache.svg)](https://badge.fury.io/js/%40alesmenzel%2Fcache)

Caching module for asynchrounous functions.

## Installation

```bash
npm i @alesmenzel/cache
```

## Storages (built in)

See [examples](./example) directory too see the usage of each storage.

| code                            | description                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `new MemoryStorage()`           | In memory storage, uses Map as storage.                                              |
| `new RedisStorage(redisClient)` | Redis storage, requires [redis](https://www.npmjs.com/package/redis) module to work. |

## Usage

### Configuration

Set up the cache service with appropriete storage solution, in our case it is redis. (There is also built in in memory storage `MemoryStorage`). Function `createCache` accepts [options](#options) that can be overridden when registering a function (see code below).

```js
const redis = require('redis');
const { createCache, RedisStorage } = require('@alesmenzel/cache');

const redis = redis.createClient('redis://localhost:6379');
const register = createCache({
  storage: new RedisStorage(redis),
  ttl: 30, // seconds (defaults to 60 minutes)
  precache: 15, // seconds (time remaining), set to -1 to disable (defaults to -1)
  prefix: 'cache',
});
```

### Registering a function

The following code illustrates our service we want to cache. Note, that the function must
always have a callback as its last parameter.

```js
// Function to cache, must have a callback as last parameter
const getSum = (a, b, next) => {
  setTimeout(() => {
    next(null, a + b);
  }, 5000);
};
```

Here we create the actual caching function. Function `register` accepts the function to cache and options as the second parameter. Those [options](#options) will override the default configuration (set in `createCache`) for this particular caching function.

```js
// Expensive function we want to cache
const myCostlyFunction = (a, b, next) => {
  setTimeout(() => {
    next(null, a + b);
  }, 10000);
}

// Here we use the `register` function from the configuratino example
// Notice we can override the global TTL and precache options
const { cache, clear } = register(myCostlyFunction, {
  ttl: 60,
  precache: 45,
  key: 'app:myCostlyFunction'
});

// `cache` is a wrapper function that accepts the same parameters as your original function
// `clear` is function that lets you clear the cache (it will purge cache for all
// inputs of the function)
cache(10, 30, (err, sum) => {
  // returns `sum = 40` from the original function (because no cache was found)
}

// Imagine some time passed (e.g. 30s)
// We call the same function with the same parameters
cache(10, 30, (err, sum) => {
  // returns `sum = 40` from the cache (because we set the ttl to 60s)
}

// More time passes (e.g. another 20s)
cache(10, 30, (err, sum) => {
  // returns `sum = 40` from the cache (because we set the ttl to 60s)
  // but also requests new data from the original function because we are in precache phase
  // Note that we still return cached data immediately and call the original
  // function in the background.
}
```

## Options

### Create cache options

Any option that is used on `register` can also be set as a default value in `createCache`.

| name      | description                                                                                                                                                  | default | overridable |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ----------- |
| `storage` | Storage engine to use. Choose from the built-in `MemoryStorage` or `RedisStorage`. Otherwise you can iplement a custom one (see (storages)[`./src/storage`]) | -       | `false`     |

### Register cache options

Overridable property means you can set it as default for `createCache` and then override it in `register`.

| name       | description                                                                                                                                                                                                                                                                                                                                            | default                                | overridable |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ----------- |
| `key`      | Key is used to uniquely identify a memoized function, by default it uses filepath to the function and its position in the file to determine uniqness. Note that the path is taken from the process´s cwd. (e.g. `/src/service/data.js:58:18`)                                                                                                          | `md5(<function-filepath>:<row>:<col>)` | `true`      |
| `ttl`      | Time to live in seconds                                                                                                                                                                                                                                                                                                                                | `3600` seconds = 1h                    | `true`      |
| `precache` | Time in seconds before the the cache expires. You can update the cache before it expires, so there are no "down times" after the cache expires and is recached.                                                                                                                                                                                        | `-1` (disabled)                        | `true`      |
| `hash`     | Hashing function is used to stringify arguments of a function and create unique arguments key. Note that by default it uses `JSON.stringify` with an object replacer function that converts objects into an array of touples, because objects do not guarantee the order of keys, which could cause different unique argument keys for the same input. | `key => md5(key)`                      | `true`      |
| `timeout`  | Time in seconds to wait for storage to return any data before calling the original function. Cache needs to be fast, in case it does not return any data in time, it should call the original function.                                                                                                                                                | `-1` (disabled)                        | `true`      |

## License

This package is developed under the [MIT license]('./LICENSE').
