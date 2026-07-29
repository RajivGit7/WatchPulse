import axios from "axios";
import { retryWithBackoff } from "../rateLimit.js";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const TIMEOUT = 10000;

const BLOCKED_KEYWORDS = [
  "reaction",
  "review",
  "explained",
  "analysis",
  "theory",
  "fan made",
  "fan edit",
  "edit",
  "amv",
  "compilation",
  "funny moments",
  "bloopers",
  "behind the scenes",
  "interview",
  "red carpet",
  "premiere",
  "discussion",
  "breakdown",
  "recap",
  "summary",
  "ending explained",
  "easter egg",
  "top 10",
  "countdown",
  "ranked",
  "best of",
  "worst",
];

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const OFFICIAL_CHANNELS = [
  "crunchyroll",
  "netflix",
  "hbo max",
  "disney",
  "amazon",
  "prime video",
  "funimation",
  "aniplex",
  "MAPPA",
  "ufotable",
  "wit studio",
  "bones",
  "madhouse",
  "kyoto animation",
  "studio ghibli",
  "liden films",
  "cloverworks",
  "a-1 pictures",
  "bandai",
  "sony pictures",
  "warner bros",
  "paramount",
  "lionsgate",
  "universal",
  "20th century",
  "marvel",
  "star wars",
  "pixar",
];

export const isOfficialChannel = (channelTitle, showTitle) => {
  const channel = (channelTitle || "").toLowerCase();
  const show = (showTitle || "").toLowerCase();

  if (channel.includes(show) || show.includes(channel)) return true;

  for (const official of OFFICIAL_CHANNELS) {
    if (channel.includes(official.toLowerCase())) return true;
  }

  return false;
};

export const searchTrailers = async (query) => {
  try {
    return await retryWithBackoff(async () => {
      const publishedAfter = new Date(Date.now() - NINETY_DAYS_MS).toISOString();

      const response = await axios.get(`${YOUTUBE_API}/search`, {
        params: {
          part: "snippet",
          q: `${query} official trailer`,
          type: "video",
          videoCategoryId: "1",
          order: "date",
          publishedAfter,
          maxResults: 10,
          key: process.env.YOUTUBE_API_KEY,
        },
        timeout: TIMEOUT,
      });

      const results = response.data.items
        .map((item) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          description: item.snippet.description,
          thumbnail:
            item.snippet.thumbnails.medium?.url ||
            item.snippet.thumbnails.default?.url,
          publishedAt: item.snippet.publishedAt,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        }))
        .filter((item) => {
          const lowerTitle = (item.title || "").toLowerCase();

          for (const keyword of BLOCKED_KEYWORDS) {
            if (lowerTitle.includes(keyword)) return false;
          }

          if (!lowerTitle.includes("official")) return false;

          return true;
        })
        .filter((item) => {
          if (!isOfficialChannel(item.channelTitle, query)) return false;

          const published = new Date(item.publishedAt);
          return published >= new Date(Date.now() - NINETY_DAYS_MS);
        })
        .slice(0, 5);

      return results;
    }, { maxRetries: 3, baseDelay: 2000, label: `YouTube search("${query}")` });
  } catch (error) {
    if (error.response?.status === 429) throw error;
    console.error("YouTube search error:", error.message);
    return [];
  }
};
