import axios from "axios";
import { retryWithBackoff } from "../rateLimit.js";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TIMEOUT = 8000;

const safeDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime()) || date.getFullYear() < 1900) return null;
  return date;
};

const fetchTMDBSearch = async (query, signal) => {
  const opts = { signal, timeout: TIMEOUT };
  const [movieRes, tvRes] = await Promise.all([
    axios.get(`${TMDB_BASE}/search/movie`, {
      ...opts,
      params: { api_key: process.env.TMDB_API_KEY, query },
    }),
    axios.get(`${TMDB_BASE}/search/tv`, {
      ...opts,
      params: { api_key: process.env.TMDB_API_KEY, query },
    }),
  ]);

  const movies = movieRes.data.results.map((item) => ({
    externalId: String(item.id),
    source: "tmdb",
    type: "movie",
    title: item.title,
    description: item.overview,
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "",
    backdrop: item.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
      : "",
    releaseStatus: item.release_date
      ? new Date(item.release_date) <= new Date()
        ? "Released"
        : "Planned"
      : "TBA",
    releaseDate: safeDate(item.release_date),
    genres: [],
    rating: item.vote_average,
    episodeCount: 0,
    seasonCount: 0,
  }));

  const tvShows = tvRes.data.results.map((item) => ({
    externalId: String(item.id),
    source: "tmdb",
    type: "tv",
    title: item.name,
    description: item.overview,
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "",
    backdrop: item.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
      : "",
    releaseStatus: item.first_air_date
      ? new Date(item.first_air_date) <= new Date()
        ? "Released"
        : "Planned"
      : "TBA",
    releaseDate: safeDate(item.first_air_date),
    genres: [],
    rating: item.vote_average,
    episodeCount: 0,
    seasonCount: item.number_of_seasons || 0,
  }));

  return [...movies, ...tvShows];
};

export const searchTMDB = async (query, signal) => {
  if (signal?.aborted) return [];
  return await retryWithBackoff(() => fetchTMDBSearch(query, signal), {
    maxRetries: 3,
    baseDelay: 1500,
    label: `TMDB search("${query}")`,
  });
};

export const getTMDBTitle = async (id, type = "movie", signal) => {
  const fetchFn = async () => {
    const endpoint = type === "tv" ? "tv" : "movie";
    const response = await axios.get(`${TMDB_BASE}/${endpoint}/${id}`, {
      params: {
        api_key: process.env.TMDB_API_KEY,
        append_to_response: "credits,watch/providers",
      },
      timeout: TIMEOUT,
      signal,
    });

    const item = response.data;
    const isTV = type === "tv";
    const genreIds = item.genres?.map((g) => g.name) || [];

    return {
      externalId: String(item.id),
      source: "tmdb",
      type: isTV ? "tv" : "movie",
      title: isTV ? item.name : item.title,
      description: item.overview,
      poster: item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : "",
      backdrop: item.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
        : "",
      releaseStatus: item.status,
      releaseDate: isTV
        ? safeDate(item.first_air_date)
        : safeDate(item.release_date),
      genres: genreIds,
      rating: item.vote_average,
      episodeCount: isTV ? item.number_of_episodes || 0 : 0,
      seasonCount: isTV ? item.number_of_seasons || 0 : 0,
      streamingAvailability: item["watch/providers"]?.results?.US?.flatrate?.map(p => p.provider_name) || null,
    };
  };

  try {
    return await retryWithBackoff(fetchFn, { label: `TMDB getTMDBTitle(${id})` });
  } catch (error) {
    if (error.response?.status === 429) throw error;
    console.error("TMDB fetch error:", error.message);
    return null;
  }
};
