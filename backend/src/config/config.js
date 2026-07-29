import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  tmdbApiKey: process.env.TMDB_API_KEY,
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  redisUrl: process.env.REDIS_URL,
  cronSyncInterval: process.env.CRON_SYNC_INTERVAL || "*/30 * * * *",
};
