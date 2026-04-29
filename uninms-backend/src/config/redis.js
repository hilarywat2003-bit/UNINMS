const { createClient } = require('redis');

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
  password: process.env.REDIS_PASSWORD || 'uninms_dev_password',
  database: parseInt(process.env.REDIS_DB || '0'),
});

client.on('error', (err) => console.error('Redis error:', err.message));
client.on('connect', () => console.log('[redis] Connected'));
client.on('reconnecting', () => console.log('[redis] Reconnecting...'));

const connectRedis = async () => {
  if (!client.isOpen) await client.connect();
  return client;
};

module.exports = { client, connectRedis };
