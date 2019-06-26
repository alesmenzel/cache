# 🎲 Cache [![npm version](https://badge.fury.io/js/%40alesmenzel%2Fcache.svg)](https://badge.fury.io/js/%40alesmenzel%2Fcache)

Caching module for asynchrounous callback functions.

## Installation

```bash
npm i @alesmenzel/cache
```

## Storages (built in)

See [examples](./example) directory too see the usage of each storage.

| code                            | description                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `new RedisStorage(redisClient)` | Redis storage, requires [redis](https://www.npmjs.com/package/redis) module to work. |

## Usage

### Configuration

Set up the cache service with appropriete storage, in our case it is redis. Function `createCache` accepts the storage and also [options](#options), those can be overridden when registering a function (see code below).

```js
const redis = require('redis');
const { createCache, RedisStorage } = require('@alesmenzel/cache');

const redis = redis.createClient('redis://localhost:6379');
redis.on('error', err => {
  // handle error
});

const Cache = createCache({
  storage: new RedisStorage(redis),
  ttl: '30min', // time to keep the cache in storage
  precache: '25min', // if we call the cached function after 25minutes and before the cache is expired (30min), it will seamlessly recache and update the ttl for another 30mins (when precaching, the data are returned from cache immediately and the original function is run in the background)
  prefix: 'cache', // prefix all cache keys
});
Cache.on('error', err => {
  // handle error (e.g. when storage fails, or original function call fails in precaching)
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

Here we create the actual caching function. Function `Cache.register` accepts the function to cache and options as the second parameter. Those [options](#options) will override the default configuration (set in `createCache`) for this particular caching function.

```js
// Expensive function we want to cache
const myCostlyFunction = (a, b, next) => {
  setTimeout(() => {
    next(null, a + b);
  }, 10000);
}

// Here we use the `register` function from the configuratino example
// Notice we can override the global TTL and precache options
const { cache, clear } = Cache.register(myCostlyFunction, {
  ttl: '60min',
  precache: '45min',
  key: 'app:myCostlyFunction'
});

// `cache` is a wrapper function that accepts the same parameters as your original function
// `clear` is function that lets you clear the cache (it will delete cache for all
// inputs of the function)
cache(10, 30, (err, sum) => {
  // returns `sum = 40` from the original function (because no cache was found)
}

// Imagine some time passed (e.g. 30min)
// We call the same function with the same parameters
cache(10, 30, (err, sum) => {
  // returns `sum = 40` from the cache (because we set the ttl to 60min)
}

// More time passes (e.g. another 20min)
cache(10, 30, (err, sum) => {
  // returns `sum = 40` from the cache (because we set the ttl to 60min)
  // but also requests new data from the original function because we are in precache phase
  // Note that we still return cached data immediately and call the original
  // function in the background.
}
```

## Options

### Create cache options

Any option that is used on `register` can also be set as a default value in `createCache`.

| name      | description                                                                                                                                                  | default |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `storage` | Storage engine to use. Choose from the built-in `MemoryStorage` or `RedisStorage`. Otherwise you can iplement a custom one (see (storages)[`./src/storage`]) | -       |
| `options` | Global options (see cache options below)                                                                                                                     | `{}`    |

### Register cache options

| name       | description                                                                                                                                                                                                                                                                                                                     | default                                | overridable |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------- |
| `key`      | Key is used to uniquely identify a memoized function, by default it uses filepath to the function and its position in the file to determine uniqness. Note that the path is taken from the process´s cwd. (e.g. `/src/service/data.js:58:18`) If you want to control the name, set it to a unique string per register function. | `md5(<function-filepath>:<row>:<col>)` | `true`      |
| `ttl`      | Time to live in seconds or a ms string like `2h`.                                                                                                                                                                                                                                                                               | `3600` seconds (1 hour)                | `true`      |
| `precache` | Time in seconds or ms package string like `24hours`. It defines the after which it should precache the function if you call it. (e.g. You can update the cache before it expires, so there are no "down times" after the cache expires.) Set to `null` or `-1` to disable.                                                      | `null` (disabled)                      | `true`      |
| `hash`     | Hashing function is used to stringify arguments of a function and create unique arguments key. Note that by default it uses `fast-stable-json-stringify` to guarantee the same result for objects with different key order.                                                                                                     | `key => md5(stringify(key))`           | `true`      |
| `timeout`  | Time in seconds to wait for storage to return any data before calling the original function. Cache needs to be fast, in case it does not return any data in time, it should call the original function. Set to `null` or `-1` to disable.                                                                                       | `null` (disabled)                      | `true`      |

## License

This package is developed under the [MIT license]('./LICENSE').
