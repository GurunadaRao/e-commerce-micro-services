const redis = require("redis");

const client = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

client.on("error", (err) => console.error("Redis Client Error", err));

async function initRedis() {
  try {
    await client.connect();
    console.log("Redis connected successfully (auth)");
  } catch (err) {
    console.error("Failed to connect to Redis:", err.message);
  }
}

module.exports = {
  client,
  initRedis,
};
