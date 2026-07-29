import axios from "axios";
import { retryWithBackoff, anilistQueue, anilistBreaker } from "../rateLimit.js";

const ANILIST_API = "https://graphql.anilist.co";
const TIMEOUT = 30000;

const SEASON_PATTERNS = [
  /\s*[:\-]\s*The\s+Final\s+Season.*$/i,
  /\s*[:\-]\s*Final\s+Season.*$/i,
  /\s+Final\s+Season.*$/i,
  /\s+\d+(?:st|nd|rd|th)\s+Season.*$/i,
  /\s+Season\s+\d+.*$/i,
  /\s+Part\s+\d+.*$/i,
  /\s+Cour\s*\d+.*$/i,
  /\s+S\d+.*$/i,
];

export const extractFranchise = (title) => {
  let base = title;
  for (const pattern of SEASON_PATTERNS) {
    const cleaned = base.replace(pattern, "").trim();
    if (cleaned && cleaned.length >= 2) {
      base = cleaned;
      break;
    }
  }
  return base;
};

export const extractSeasonLabel = (title, franchise) => {
  if (!franchise || title === franchise) return "";
  const suffix = title.slice(franchise.length).trim();
  return suffix || "";
};

const SEARCH_QUERY = `
  query ($search: String, $page: Int) {
    Page(page: $page, perPage: 10) {
      media(search: $search, type: ANIME) {
        id
        title { romaji english native }
        description
        coverImage { large medium }
        bannerImage
        status
        startDate { year month day }
        genres
        averageScore
        episodes
        nextAiringEpisode { episode airingAt }
        relations {
          edges {
            relationType
            node {
              id
              title { romaji english }
              type
              status
              coverImage { large medium }
              bannerImage
              startDate { year month day }
              genres
              averageScore
              episodes
              nextAiringEpisode { episode airingAt }
            }
          }
        }
      }
    }
  }
`;

const MEDIA_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english native }
      description
      coverImage { large medium }
      bannerImage
      status
      startDate { year month day }
      genres
      averageScore
      episodes
      nextAiringEpisode { episode airingAt }
      relations {
        edges {
          relationType
          node {
            id
            title { romaji english }
            type
            status
            coverImage { large medium }
            bannerImage
            startDate { year month day }
            genres
            averageScore
            episodes
            nextAiringEpisode { episode airingAt }
          }
        }
      }
    }
  }
`;

const safeDate = (year, month, day) => {
  if (!year) return null;
  const m = month || 1;
  const d = day || 1;
  const date = new Date(year, m - 1, d);
  if (isNaN(date.getTime()) || date.getFullYear() < 1900) return null;
  return date;
};

const mapMedia = (media) => {
  const title = media.title.english || media.title.romaji;
  const franchise = extractFranchise(title);
  const seasonLabel = extractSeasonLabel(title, franchise);

  const relatedEntries = (media.relations?.edges || [])
    .filter((edge) =>
      ["SEQUEL", "PREQUEL", "SIDE_STORY", "SPIN_OFF", "ALTERNATIVE"].includes(
        edge.relationType
      ) && edge.node.type === "ANIME"
    )
    .map((edge) => ({
      externalId: String(edge.node.id),
      relationType: edge.relationType,
      title: edge.node.title.english || edge.node.title.romaji,
      status: edge.node.status,
      poster: edge.node.coverImage?.large || "",
      backdrop: edge.node.bannerImage || "",
      releaseDate: safeDate(edge.node.startDate?.year, edge.node.startDate?.month, edge.node.startDate?.day),
      genres: edge.node.genres || [],
      rating: edge.node.averageScore ? edge.node.averageScore / 10 : 0,
      episodes: edge.node.episodes || 0,
      nextAiringEpisode: edge.node.nextAiringEpisode || null,
    }));

  return {
    externalId: String(media.id),
    source: "anilist",
    type: "anime",
    title,
    franchise,
    seasonLabel,
    description: media.description,
    poster: media.coverImage.large,
    backdrop: media.bannerImage,
    releaseStatus: media.status,
    releaseDate: safeDate(media.startDate?.year, media.startDate?.month, media.startDate?.day),
    genres: media.genres,
    rating: media.averageScore / 10,
    episodeCount: media.episodes || 0,
    nextEpisodeDate: media.nextAiringEpisode?.airingAt
      ? new Date(media.nextAiringEpisode.airingAt * 1000)
      : null,
    nextEpisodeNumber: media.nextAiringEpisode?.episode || null,
    relatedEntries,
  };
};

const anilistPost = async (query, variables, signal) => {
  if (anilistBreaker.isOpen()) {
    console.warn("AniList circuit breaker open, skipping request.");
    return null;
  }

  return anilistQueue.run(async () => {
    try {
      const response = await axios.post(ANILIST_API, { query, variables }, { timeout: TIMEOUT, signal });
      anilistBreaker.recordSuccess();
      return response;
    } catch (error) {
      anilistBreaker.recordFailure();
      throw error;
    }
  });
};

export const searchAniList = async (query, signal) => {
  try {
    return await retryWithBackoff(async () => {
      const response = await anilistPost(SEARCH_QUERY, { search: query, page: 1 }, signal);
      if (!response) return [];

      const mediaList = response.data.data.Page.media;
      if (!mediaList || mediaList.length === 0) return [];

      return mediaList.map(mapMedia);
    }, { maxRetries: 3, baseDelay: 3000, label: `AniList search("${query}")` });
  } catch (error) {
    if (error.response?.status === 429) throw error;
    console.error("AniList search error:", error.message);
    return [];
  }
};

export const getAniListTitle = async (id) => {
  try {
    return await retryWithBackoff(async () => {
      const response = await anilistPost(MEDIA_QUERY, { id: parseInt(id) });
      if (!response) return null;

      const media = response.data.data.Media;
      if (!media) return null;

      return mapMedia(media);
    }, { maxRetries: 3, baseDelay: 3000, label: `AniList get(${id})` });
  } catch (error) {
    if (error.response?.status === 429) throw error;
    console.error("AniList fetch error:", error.message);
    return null;
  }
};
