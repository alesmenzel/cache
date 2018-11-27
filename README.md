# 🎲 Cache [![npm version](https://badge.fury.io/js/%40alesmenzel%2Fcache.svg)](https://badge.fury.io/js/%40alesmenzel%2Fcache)

Caching module for asynchrounous functions.

## Installation

```bash
npm i @alesmenzel/cache
```

## Storages (built in)

See [examples](./examples) directory too see the usage of each storage.

| code                            | description                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `new MemoryStorage()`           | In memory storage, uses Map as storage.                                              |
| `new RedisStorage(redisClient)` | Redis storage, requires [redis](https://www.npmjs.com/package/redis) module to work. |

## Usage

### Configuration

Set up the cache service with appropriete storage solution, in our case it is redis. (There is also built in in memory storage `MemoryStorage`). Function `createCache` accepts options that can be overridden when registering a function cache (see below). See [options](#options).

```js
const { createCache, RedisStorage } = require('@alesmenzel/cache');
const { createClient } = require('redis');

const redis = createClient('redis://localhost:6379');
const register = createCache({
  storage: new RedisStorage(redis),
  ttl: 30, // seconds (defaults to 60 minutes)
  precache: 15, // seconds (time remaining), set to -1 to disable (defaults to -1)
});
```

### Registering a function

The following `getSum` code illustrates our service we want to cache. Note, that the function must
always have callback as its last parameter.

```js
// Function to cache, must have callback as last parameter
const getSum = (a, b, next) => {
  setTimeout(() => {
    next(null, a + b);
  }, 5000);
};
```

Here we create the actual caching function. Function `register` accepts the function to cache and options as a seconds parameter. Those options will override the default configuration set in `createCache` for this particular caching function. See [options](#options).

```js
// Expensive function we want to cache
const myCostlyFunction = (a, b, next) => {
  setTimeout(() => {
    next(null, a + b);
  }, 10000);
}

// Here we use the `register` function from the configuratino example
// Notice we can override the global TTL and precache options
const { cache, clear } = register(myCostlyFunction, { ttl: 60, precache: 45 });

// `cache` is a wrapper function that accepts the same parameters as your original function
// `clear` is function that lets you clear the cache (it will purge cache for all
// inputs for the function)
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

// More time passes (e.g. another 5s)
// The original function still did not return data
cache(10, 30, (err, sum) => {
  // returns `sum = 40` from the cache (because we set the ttl to 60s)
  // We are in precache phase so we should request new data, but we have already
  // called it and are waiting for the response in the previous call - so instead
  // of calling it again and creating race conditions, we wait for the original
  // request (so no matter how many times you call your cache(...), precache is
  // called only single time).
}
```

## Options

### Create cache options

Any option that is used on `register` can be also set as a default value in `createCache`.

| name      | description                                                                                                                                                                | default | overridable |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| `storage` | Storage engine to use. There is no default, the user must choose. There are build in `MemoryStorage` and `RedisStorage`. Or you can iplement custom one (see `./storages`) | -       | `false`     |

### Register cache options

Overridable property means you can set it as default for `createCache` and then override it in `register`.

| name       | description                                                                                                                                                                                                                                                                                                                                               | default                                           | overridable |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------- |
| `key`      | Key is used to uniquely identify a memoized function, by default it uses filepath to the function and its position in the file to determine uniqness. Note that the path is taken from the process´s cwd. (e.g. `/src/service/data.js:58:18`)                                                                                                             | `md5(<function-filepath>:<row>:<col>)`            | `true`      |
| `ttl`      | Time to live in seconds                                                                                                                                                                                                                                                                                                                                   | `3600` seconds = 1h                               | `true`      |
| `precache` | Time in seconds before the the cache expires. You can update the cache before it expires, so there are no "down times" after the cache expires and is recached. **Note that multiple calls to the cache will result in a single precache call.**                                                                                                          | `-1` (disabled)                                   | `true`      |
| `hash`     | Hashing function that is used to hash the function unique key and arguments key.                                                                                                                                                                                                                                                                          | `key => md5(key)`                                 | `true`      |
| `resolve`  | Resolve function is used to stringify arguments of a function and create unique arguments key. **Note** that by default is used `JSON.stringify` with a object replacer function that converts objects to array of touples because objects **do not guarantee the order of keys**. (Which could cause different unique argument keys for the same input.) | `key => md5(JSON.stringify(key, replaceObjects))` | `true`      |
| `timeout`  | Time in seconds to wait for cache before calling the original function. Cache needs to be fast, in case it does not return any data in time, it should call the original function.                                                                                                                                                                        | `-1` (disabled)                                   | `true`      |

## License

This package is developed under the [MIT licence]('./LICENCE').
