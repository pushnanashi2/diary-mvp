const redis = require('redis');

let client;

if (process.env.NODE_ENV !== 'test') {
  client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  client.on('error', (err) => console.error('Redis Client Error', err));
  client.connect();
} else {
  // Mock Redis client for testing
  client = {
    get: async () => null,
    set: async () => 'OK',
    setex: async () => 'OK',
    del: async () => 1,
    quit: async () => 'OK',
  };
}

module.exports = client;
