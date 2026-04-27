const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL
});

client.on('error', (err) => console.error('Redis error:', err));
client.on('connect', () => console.log('Redis connected'));

let connected = false;

async function getClient() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client;
}

async function setTokens(tokens) {
  const redis = await getClient();
  await redis.set('strava:tokens', JSON.stringify(tokens));
}

async function getTokens() {
  const redis = await getClient();
  const data = await redis.get('strava:tokens');
  return data ? JSON.parse(data) : null;
}

async function clearTokens() {
  const redis = await getClient();
  await redis.del('strava:tokens');
}

module.exports = { getClient, setTokens, getTokens, clearTokens };