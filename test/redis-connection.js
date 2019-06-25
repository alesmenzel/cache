const redis = require('redis');

const client = redis.createClient({
  host: '127.0.0.1',
  port: '6379',
});

client.on('error', err => {
  // eslint-disable-next-line no-console
  console.log(err);
  process.exit(1);
});

module.exports = client;
