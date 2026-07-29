import { searchAniList } from "../services/anilist/anilistService.js";
import { searchTMDB } from "../services/tmdb/tmdbService.js";

export const searchTitles = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const [anilistResults, tmdbResults] = await Promise.allSettled([
      searchAniList(query, controller.signal),
      searchTMDB(query, controller.signal),
    ]);

    clearTimeout(timer);

    const results = [];
    const warnings = [];

    if (anilistResults.status === "fulfilled") {
      results.push(...anilistResults.value);
    } else {
      warnings.push("AniList search timed out");
    }

    if (tmdbResults.status === "fulfilled") {
      results.push(...tmdbResults.value);
    } else {
      warnings.push("TMDB search timed out — check API key or network");
    }

    res.json({ results, warnings });
  } catch (error) {
    next(error);
  }
};
