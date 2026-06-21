const User = require("../models/user");
const { client: redisClient } = require("../utils/redis");

/**
 * Class to encapsulate the logic for the user repository
 */
class UserRepository {
  async createUser(user) {
    const createdUser = await User.create(user);
    try {
      await redisClient.del(`user:username:${user.username}`);
      console.log(`Redis cache invalidated for user: ${user.username}`);
    } catch (err) {
      console.error("Redis delete error on user creation:", err);
    }
    return createdUser;
  }

  async getUserByUsername(username) {
    const cacheKey = `user:username:${username}`;
    try {
      const cachedUser = await redisClient.get(cacheKey);
      if (cachedUser) {
        console.log(`Redis hit for user: ${username}`);
        return JSON.parse(cachedUser);
      }
    } catch (err) {
      console.error("Redis get error in userRepository:", err);
    }

    console.log(`Redis miss for user: ${username}`);
    const user = await User.findOne({ username });
    if (user) {
      try {
        // Cache user profile for 5 minutes (300 seconds)
        await redisClient.set(cacheKey, JSON.stringify(user), { EX: 300 });
      } catch (err) {
        console.error("Redis set error in userRepository:", err);
      }
    }
    return user;
  }
}

module.exports = UserRepository;
