import cron from "node-cron";
import connectDB from "../config/db.js";
import { config } from "../config/config.js";
import Watchlist from "../models/Watchlist.js";
import Title from "../models/Title.js";
import Update from "../models/Update.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";
import { getAniListTitle } from "../services/anilist/anilistService.js";
import { getTMDBTitle } from "../services/tmdb/tmdbService.js";
import { summarizeUpdate, classifyRSSEvent, isAIAvailable } from "../services/groq/groqService.js";
import { searchTrailers } from "../services/youtube/youtubeService.js";
import { fetchRSSNews } from "../services/rss/rssService.js";
import { isRateLimited, markRateLimited, delay, anilistBreaker } from "../services/rateLimit.js";

let syncRunning = false;

const VALID_TYPES = [
  "episode_released",
  "movie_released",
  "season_released",
  "season_confirmed",
  "release_date_announced",
  "release_date_changed",
  "release_delayed",
  "official_trailer_released",
  "official_teaser_released",
  "official_poster_released",
  "streaming_platform_changed",
  "news_article",
];

const cleanupOldData = async () => {
  console.log("Cleaning up old/invalid data...");

  const invalidTypesResult = await Update.deleteMany({
    type: { $nin: VALID_TYPES },
  });
  if (invalidTypesResult.deletedCount > 0) {
    console.log(`Removed ${invalidTypesResult.deletedCount} updates with old/invalid types.`);
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const oldTrailersResult = await Update.deleteMany({
    type: { $in: ["official_trailer_released", "official_teaser_released"] },
    detectedAt: { $lt: sevenDaysAgo },
  });
  if (oldTrailersResult.deletedCount > 0) {
    console.log(`Removed ${oldTrailersResult.deletedCount} old trailer updates.`);
  }

  const stalePendingResult = await Update.deleteMany({
    status: "pending_classification",
    detectedAt: { $lt: sevenDaysAgo },
  });
  if (stalePendingResult.deletedCount > 0) {
    console.log(`Removed ${stalePendingResult.deletedCount} stale pending classifications.`);
  }

  const allUpdates = await Update.find({
    type: { $in: ["release_date_announced", "release_date_changed", "release_delayed"] },
  }).sort({ detectedAt: -1 }).lean();

  const dateUpdatesToDelete = [];
  const seenDateKeys = new Map();
  for (const u of allUpdates) {
    const titleId = u.title.toString();
    const date = u.rawData?.date || u.rawData?.new || u.rawData?.eventDate;
    const key = `${titleId}:${u.type}:${date}`;
    if (seenDateKeys.has(key)) {
      dateUpdatesToDelete.push(u._id);
    } else {
      seenDateKeys.set(key, u._id);
    }
  }
  if (dateUpdatesToDelete.length > 0) {
    await Update.deleteMany({ _id: { $in: dateUpdatesToDelete } });
    console.log(`Removed ${dateUpdatesToDelete.length} duplicate date-related updates.`);
  }

  const validUpdateIds = await Update.distinct("_id");
  const orphanResult = await Notification.deleteMany({
    update: { $nin: validUpdateIds },
  });
  if (orphanResult.deletedCount > 0) {
    console.log(`Removed ${orphanResult.deletedCount} orphan notifications.`);
  }

  const recentUpdates = await Update.find({
    type: { $in: ["release_date_announced", "release_date_changed", "release_delayed"] },
  }).lean();
  const invalidDateIds = recentUpdates.filter(u => {
    const dates = [u.rawData?.date, u.rawData?.new, u.rawData?.eventDate].filter(Boolean);
    return dates.some(d => {
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) || parsed.getFullYear() < 1900;
    });
  }).map(u => u._id);
  if (invalidDateIds.length > 0) {
    await Update.deleteMany({ _id: { $in: invalidDateIds } });
    console.log(`Removed ${invalidDateIds.length} updates with invalid dates (pre-1900).`);
  }

  console.log("Cleanup complete.");
};

const backfillEpisodeNumbers = async () => {
  const types = ["release_delayed", "release_date_announced", "release_date_changed"];
  const updates = await Update.find({
    type: { $in: types },
    "rawData.episodeNumber": { $exists: false },
  }).populate("title");

  if (updates.length === 0) return;

  console.log(`Backfilling episode numbers for ${updates.length} updates...`);

  const episodeCache = new Map();

  for (const update of updates) {
    const titleDoc = update.title;
    if (!titleDoc) continue;

    let ep = titleDoc.nextEpisodeNumber;

    if (!ep && titleDoc.source === "anilist") {
      if (!episodeCache.has(titleDoc.externalId)) {
        try {
          const fresh = await getAniListTitle(titleDoc.externalId);
          episodeCache.set(titleDoc.externalId, fresh?.nextEpisodeNumber || null);
          if (fresh?.nextEpisodeNumber) {
            await Title.findByIdAndUpdate(titleDoc._id, { nextEpisodeNumber: fresh.nextEpisodeNumber });
          }
          await delay(5000);
        } catch {
          episodeCache.set(titleDoc.externalId, null);
        }
      }
      ep = episodeCache.get(titleDoc.externalId);
    }

    if (!ep) continue;

    await Update.updateOne(
      { _id: update._id },
      { $set: { "rawData.episodeNumber": ep } }
    );

    const summary = await summarizeUpdate({
      type: update.type,
      rawData: { ...update.rawData, episodeNumber: ep },
      titleName: titleDoc.title,
    });
    await Update.updateOne({ _id: update._id }, { $set: { summary } });
  }

  console.log("Episode number backfill complete.");
};

const PRIORITY_MAP = {
  release_delayed: "critical",
  episode_released: "high",
  movie_released: "high",
  season_released: "high",
  season_confirmed: "high",
  release_date_announced: "high",
  release_date_changed: "medium",
  streaming_platform_changed: "medium",
  official_trailer_released: "medium",
  official_teaser_released: "medium",
  official_poster_released: "low",
  news_article: "low",
};

const createUpdateAndNotify = async (titleId, type, summary, rawData) => {
  if (rawData?.videoId) {
    const duplicate = await Update.findOne({
      type,
      "rawData.videoId": rawData.videoId,
    }).lean();
    if (duplicate) return null;
  }

  const linkDuplicate = rawData?.link
    ? await Update.findOne({
        title: titleId,
        "rawData.link": rawData.link,
      }).lean()
    : null;
  if (linkDuplicate) return null;

  const eventDate = rawData?.eventDate || rawData?.date;
  if (eventDate) {
    const semanticDuplicate = await Update.findOne({
      title: titleId,
      type,
      status: "active",
      $or: [
        { "rawData.eventDate": eventDate },
        { "rawData.date": eventDate },
      ],
    }).lean();
    if (semanticDuplicate) return null;
  }

  if (type === "release_date_announced" || type === "release_date_changed" || type === "release_delayed") {
    const existingSimilar = await Update.findOne({
      title: titleId,
      type,
      status: "active",
    }).sort({ detectedAt: -1 }).lean();
    if (existingSimilar) {
      const existingDate = existingSimilar.rawData?.eventDate || existingSimilar.rawData?.date || existingSimilar.rawData?.new;
      const newDate = rawData?.eventDate || rawData?.date || rawData?.new;
      if (existingDate && newDate && new Date(existingDate).getTime() === new Date(newDate).getTime()) return null;
    }
  }

  const update = await Update.create({
    title: titleId,
    type,
    summary,
    rawData,
    priority: PRIORITY_MAP[type] || "medium",
  });

  const watchlistEntries = await Watchlist.find({ title: titleId });
  if (watchlistEntries.length > 0) {
    const notifications = watchlistEntries.map((entry) => ({
      user: entry.user,
      title: titleId,
      update: update._id,
      message: summary,
      priority: PRIORITY_MAP[type] || "medium",
    }));
    await Notification.insertMany(notifications, { ordered: false });
  }

  return update;
};

const syncTitle = async (title, options = {}) => {
  const { detectChanges: shouldDetectChanges = true } = options;
  if (isRateLimited("anilist") && isRateLimited("tmdb")) return false;

  try {
    let freshData;
    if (title.source === "anilist") {
      freshData = await getAniListTitle(title.externalId);
    } else if (title.source === "tmdb") {
      freshData = await getTMDBTitle(title.externalId, title.type);
    }

    if (!freshData) return true;

    const changes = shouldDetectChanges ? detectChanges(title, freshData) : [];

    for (const change of changes) {
      const summary = await summarizeUpdate({
        ...change,
        titleName: title.title,
      });
      await createUpdateAndNotify(title._id, change.type, summary, change.rawData);

      if (change.type === "episode_released") {
        const epNum = change.rawData.episode;
        await Update.deleteMany({
          title: title._id,
          type: { $in: ["release_delayed", "release_date_announced", "release_date_changed"] },
          "rawData.episodeNumber": epNum,
        });
      }

      if (isAIAvailable()) await delay(1000);
    }

    const updateFields = {};
    if (freshData.episodeCount != null) updateFields.episodeCount = freshData.episodeCount;
    if (freshData.seasonCount != null) updateFields.seasonCount = freshData.seasonCount;
    if (freshData.releaseStatus) updateFields.releaseStatus = freshData.releaseStatus;
    if (freshData.nextEpisodeDate !== undefined) updateFields.nextEpisodeDate = freshData.nextEpisodeDate;
    if (freshData.nextEpisodeNumber !== undefined) updateFields.nextEpisodeNumber = freshData.nextEpisodeNumber;
    updateFields.lastSyncedAt = new Date();

    await Title.findByIdAndUpdate(title._id, updateFields);
    return true;
  } catch (error) {
    if (error.response?.status === 429) {
      const api = title.source === "anilist" ? "anilist" : "tmdb";
      const retryAfter = error.response?.headers?.["retry-after"];
      const cooldownMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
      markRateLimited(api, cooldownMs);
      return false;
    }
    console.error(`Sync error for ${title.title}:`, error.message);
    return true;
  }
};

const detectChanges = (existing, fresh) => {
  const changes = [];

  const isValidDate = (d) => d && !isNaN(new Date(d).getTime()) && new Date(d).getFullYear() >= 1900;

  if (fresh.nextEpisodeNumber && existing.nextEpisodeNumber && fresh.nextEpisodeNumber > existing.nextEpisodeNumber) {
    changes.push({
      type: "episode_released",
      rawData: {
        episode: existing.nextEpisodeNumber,
        old: existing.nextEpisodeNumber,
        nextEpisode: fresh.nextEpisodeNumber,
      },
    });
  } else if (existing.episodeCount > 0 && fresh.episodeCount > existing.episodeCount) {
    changes.push({
      type: "episode_released",
      rawData: {
        episode: fresh.episodeCount,
        old: existing.episodeCount,
        new: fresh.episodeCount,
      },
    });
  }

  if (existing.seasonCount > 0 && fresh.seasonCount > existing.seasonCount) {
    changes.push({
      type: "season_released",
      rawData: {
        season: fresh.seasonCount,
        old: existing.seasonCount,
        new: fresh.seasonCount,
      },
    });
  }

  if (
    fresh.streamingAvailability &&
    existing.streamingAvailability &&
    JSON.stringify(fresh.streamingAvailability) !==
      JSON.stringify(existing.streamingAvailability)
  ) {
    changes.push({
      type: "streaming_platform_changed",
      rawData: {
        old: existing.streamingAvailability,
        new: fresh.streamingAvailability,
      },
    });
  }

  if (isValidDate(fresh.nextEpisodeDate) && !isValidDate(existing.nextEpisodeDate)) {
    changes.push({
      type: "release_date_announced",
      rawData: {
        date: fresh.nextEpisodeDate,
        old: null,
        new: fresh.nextEpisodeDate,
        episodeNumber: fresh.nextEpisodeNumber || existing.nextEpisodeNumber || null,
      },
    });
  } else if (
    isValidDate(fresh.nextEpisodeDate) &&
    isValidDate(existing.nextEpisodeDate) &&
    new Date(fresh.nextEpisodeDate).getTime() !==
      new Date(existing.nextEpisodeDate).getTime()
  ) {
    const diffMs = new Date(fresh.nextEpisodeDate) - new Date(existing.nextEpisodeDate);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays > 7) {
      changes.push({
        type: "release_delayed",
        rawData: {
          old: existing.nextEpisodeDate,
          new: fresh.nextEpisodeDate,
          delayDays: Math.round(diffDays),
          episodeNumber: fresh.nextEpisodeNumber || existing.nextEpisodeNumber || null,
        },
      });
    } else {
      changes.push({
        type: "release_date_changed",
        rawData: {
          old: existing.nextEpisodeDate,
          new: fresh.nextEpisodeDate,
          episodeNumber: fresh.nextEpisodeNumber || existing.nextEpisodeNumber || null,
        },
      });
    }
  }

  if (isValidDate(fresh.releaseDate) && !isValidDate(existing.releaseDate) && !changes.some(c => c.type === "release_date_announced")) {
    changes.push({
      type: "release_date_announced",
      rawData: {
        date: fresh.releaseDate,
        old: null,
        new: fresh.releaseDate,
      },
    });
  } else if (
    isValidDate(fresh.releaseDate) &&
    isValidDate(existing.releaseDate) &&
    new Date(fresh.releaseDate).getTime() !==
      new Date(existing.releaseDate).getTime() &&
    !changes.some(c => c.type === "release_date_changed" || c.type === "release_delayed")
  ) {
    const diffMs = new Date(fresh.releaseDate) - new Date(existing.releaseDate);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays > 7) {
      changes.push({
        type: "release_delayed",
        rawData: {
          old: existing.releaseDate,
          new: fresh.releaseDate,
          delayDays: Math.round(diffDays),
        },
      });
    } else {
      changes.push({
        type: "release_date_changed",
        rawData: {
          old: existing.releaseDate,
          new: fresh.releaseDate,
        },
      });
    }
  }

  if (
    fresh.releaseStatus &&
    existing.releaseStatus &&
    fresh.releaseStatus !== existing.releaseStatus
  ) {
    if (
      fresh.releaseStatus.toLowerCase().includes("series") ||
      fresh.releaseStatus.toLowerCase().includes("returning")
    ) {
      changes.push({
        type: "season_confirmed",
        rawData: {
          old: existing.releaseStatus,
          new: fresh.releaseStatus,
        },
      });
    }

    if (
      fresh.releaseStatus.toLowerCase() === "released" &&
      existing.releaseStatus.toLowerCase() !== "released"
    ) {
      changes.push({
        type: "movie_released",
        rawData: {
          old: existing.releaseStatus,
          new: fresh.releaseStatus,
          releaseDate: fresh.releaseDate,
        },
      });
    }
  }

  if (changes.some((c) => c.type === "episode_released")) {
    return changes.filter((c) => c.type !== "release_date_changed");
  }

  return changes;
};

const normalizeTrailerTitle = (raw) => {
  return (raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const deduplicateTrailers = (trailers) => {
  const seen = [];
  for (const trailer of trailers) {
    const norm = normalizeTrailerTitle(trailer.title);
    const isDuplicate = seen.some((s) => {
      const sNorm = s.normalized;
      if (norm === sNorm) return true;
      if (norm.includes(sNorm) || sNorm.includes(norm)) return true;
      const normWords = norm.split(" ").filter((w) => w.length > 3);
      const sWords = sNorm.split(" ").filter((w) => w.length > 3);
      if (normWords.length > 0 && sWords.length > 0) {
        const matching = normWords.filter((w) => sWords.includes(w));
        if (matching.length >= Math.min(normWords.length, sWords.length) * 0.7) return true;
      }
      return false;
    });
    if (!isDuplicate) seen.push({ normalized: norm, trailer });
  }
  return seen.map((s) => s.trailer);
};

const syncTrailers = async (title) => {
  if (isRateLimited("youtube")) return false;

  try {
    const rawTrailers = await searchTrailers(title.title);
    if (rawTrailers.length === 0) return true;

    const trailers = deduplicateTrailers(rawTrailers);

    const existingTrailers = await Update.find({
      type: { $in: ["official_trailer_released", "official_teaser_released"] },
    }).lean();

    const existingVideoIds = new Set(
      existingTrailers.map((e) => e.rawData?.videoId).filter(Boolean)
    );

    for (const trailer of trailers) {
      if (existingVideoIds.has(trailer.videoId)) continue;

      const lowerTitle = (trailer.title || "").toLowerCase();
      const isTeaser = lowerTitle.includes("teaser");
      const type = isTeaser ? "official_teaser_released" : "official_trailer_released";

      const summary = await summarizeUpdate({
        type,
        rawData: { trailerTitle: trailer.title, url: trailer.url, videoId: trailer.videoId },
        titleName: title.title,
      });

      await createUpdateAndNotify(title._id, type, summary, trailer);
      if (isAIAvailable()) await delay(1000);
    }
    return true;
  } catch (error) {
    if (error.response?.status === 429) {
      const retryAfter = error.response?.headers?.["retry-after"];
      const cooldownMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
      markRateLimited("youtube", cooldownMs);
      return false;
    }
    console.error(`Trailer sync error for ${title.title}:`, error.message);
    return true;
  }
};

const syncRSSNews = async () => {
  if (isRateLimited("groq")) {
    console.log("Skipping RSS sync: Groq rate limited.");
    return;
  }

  try {
    const newsItems = await fetchRSSNews();
    if (newsItems.length === 0) return;

    const watchlistEntries = await Watchlist.find({}).populate("title");
    const followedTitleMap = new Map();
    for (const entry of watchlistEntries) {
      if (entry.title) {
        const id = entry.title._id.toString();
        if (!followedTitleMap.has(id)) {
          followedTitleMap.set(id, entry.title);
        }
      }
    }

    const followedTitles = Array.from(followedTitleMap.values());

    for (const item of newsItems) {
      if (isRateLimited("groq")) {
        console.log("Groq rate limited during RSS sync, stopping.");
        break;
      }

      const matchedTitles = followedTitles.filter((t) => {
        const name = t.title.toLowerCase();
        return (
          item.title.toLowerCase().includes(name) ||
          item.description.toLowerCase().includes(name)
        );
      });

      for (const title of matchedTitles) {
        const alreadyExists = await Update.findOne({
          title: title._id,
          "rawData.link": item.link,
        }).lean();
        if (alreadyExists) continue;

        if (!isAIAvailable()) {
          await Update.create({
            title: title._id,
            type: "release_date_announced",
            summary: `Pending classification: ${item.title}`,
            rawData: {
              link: item.link,
              source: item.source,
              newsTitle: item.title,
              newsDescription: item.description,
            },
            status: "pending_classification",
          });
          continue;
        }

        const classification = await classifyRSSEvent(item, title.title);

        if (!classification.isEvent) continue;

        const summary = classification.summary ||
          await summarizeUpdate({
            type: classification.eventType,
            rawData: { link: item.link, source: item.source, newsTitle: item.title },
            titleName: title.title,
          });

        await createUpdateAndNotify(
          title._id,
          classification.eventType,
          summary,
          {
            link: item.link,
            source: item.source,
            newsTitle: item.title,
            eventDate: classification.eventDate,
          }
        );

        await delay(2000);
      }
    }
  } catch (error) {
    console.error("RSS sync error:", error.message);
  }
};

const retryPendingClassifications = async () => {
  if (!isAIAvailable() || isRateLimited("groq")) return;

  try {
    const pending = await Update.find({ status: "pending_classification" }).limit(10);
    if (pending.length === 0) return;

    console.log(`Retrying ${pending.length} pending classifications...`);

    for (const update of pending) {
      if (isRateLimited("groq")) break;

      const titleDoc = await Title.findById(update.title);
      if (!titleDoc) {
        await Update.deleteOne({ _id: update._id });
        continue;
      }

      const rawArticle = {
        title: update.rawData?.newsTitle || "",
        description: update.rawData?.newsDescription || "",
        link: update.rawData?.link || "",
        source: update.rawData?.source || "",
      };

      const classification = await classifyRSSEvent(rawArticle, titleDoc.title);

      if (classification.isEvent) {
        const summary = classification.summary ||
          await summarizeUpdate({
            type: classification.eventType,
            rawData: { link: rawArticle.link, source: rawArticle.source, newsTitle: rawArticle.title },
            titleName: titleDoc.title,
          });

        await Update.updateOne(
          { _id: update._id },
          {
            $set: {
              type: classification.eventType,
              summary,
              "rawData.eventDate": classification.eventDate,
              status: "active",
              priority: PRIORITY_MAP[classification.eventType] || "medium",
            },
          }
        );

        const watchlistEntries = await Watchlist.find({ title: titleDoc._id });
        if (watchlistEntries.length > 0) {
          const notifications = watchlistEntries.map((entry) => ({
            user: entry.user,
            title: titleDoc._id,
            update: update._id,
            message: summary,
            priority: PRIORITY_MAP[classification.eventType] || "medium",
          }));
          await Notification.insertMany(notifications, { ordered: false });
        }
      } else {
        await Update.deleteOne({ _id: update._id });
      }

      await delay(2000);
    }
  } catch (error) {
    console.error("Pending classification retry error:", error.message);
  }
};

const scanFranchises = async () => {
  if (isRateLimited("anilist")) {
    console.log("Skipping franchise scan: AniList rate limited.");
    return;
  }

  try {
    const watchlistEntries = await Watchlist.find({}).populate("title");
    const anilistTitles = watchlistEntries
      .filter((e) => e.title?.source === "anilist")
      .map((e) => e.title);

    const uniqueTitles = [];
    const seenIds = new Set();
    for (const t of anilistTitles) {
      if (!seenIds.has(t.externalId)) {
        seenIds.add(t.externalId);
        uniqueTitles.push(t);
      }
    }

    if (uniqueTitles.length === 0) return;

    console.log(`Franchise scan: checking ${uniqueTitles.length} AniList titles...`);
    let added = 0;

    for (const title of uniqueTitles) {
      if (isRateLimited("anilist") || anilistBreaker.isOpen()) {
        console.log("AniList rate limited during franchise scan, stopping.");
        break;
      }

      try {
        const freshData = await getAniListTitle(title.externalId);
        if (!freshData?.relatedEntries?.length) {
          await delay(3000);
          continue;
        }

        const watchlistUsers = watchlistEntries
          .filter((e) => e.title?.externalId === title.externalId)
          .map((e) => e.user.toString());

        const relatedExternalIds = freshData.relatedEntries.map((e) => e.externalId);
        const existingTitles = await Title.find({
          externalId: { $in: relatedExternalIds },
          source: "anilist",
        });
        const existingTitleMap = new Map(
          existingTitles.map((t) => [t.externalId, t])
        );

        const newTitles = [];
        const titleIdMap = new Map();
        for (const entry of freshData.relatedEntries) {
          const existing = existingTitleMap.get(entry.externalId);
          if (existing) {
            titleIdMap.set(entry.externalId, existing);
          } else {
            const doc = {
              externalId: entry.externalId,
              source: "anilist",
              type: "anime",
              title: entry.title,
              franchise: title.franchise,
              description: "",
              poster: entry.poster,
              backdrop: entry.backdrop,
              releaseStatus: entry.status,
              releaseDate: entry.releaseDate,
              genres: entry.genres,
              rating: entry.rating,
              episodeCount: entry.episodes,
              seasonCount: 0,
              nextEpisodeDate: entry.nextAiringEpisode
                ? new Date(entry.nextAiringEpisode.airingAt * 1000)
                : null,
            };
            newTitles.push(doc);
            added++;
          }
        }

        let savedNewTitles = [];
        if (newTitles.length > 0) {
          savedNewTitles = await Title.insertMany(newTitles, { ordered: false });
          for (let i = 0; i < newTitles.length; i++) {
            titleIdMap.set(newTitles[i].externalId, savedNewTitles[i]);
          }
        }

        if (watchlistUsers.length > 0) {
          const allRelatedTitleIds = [...titleIdMap.values()].map((t) => t._id);
          const existingWatchlistEntries = await Watchlist.find({
            user: { $in: watchlistUsers },
            title: { $in: allRelatedTitleIds },
          });
          const existingWatchlistSet = new Set(
            existingWatchlistEntries.map((e) => `${e.user}:${e.title}`)
          );

          const newWatchlistEntries = [];
          for (const entry of freshData.relatedEntries) {
            const savedTitle = titleIdMap.get(entry.externalId);
            if (!savedTitle) continue;
            for (const userId of watchlistUsers) {
              const key = `${userId}:${savedTitle._id}`;
              if (!existingWatchlistSet.has(key)) {
                newWatchlistEntries.push({
                  user: userId,
                  title: savedTitle._id,
                  status: "planned",
                });
                existingWatchlistSet.add(key);
              }
            }
          }
          if (newWatchlistEntries.length > 0) {
            await Watchlist.insertMany(newWatchlistEntries, { ordered: false });
          }
        }

        const linkedIds = [...titleIdMap.values()].map((t) => t._id);
        const newLinkedIds = linkedIds.filter(
          (id) => !title.linkedTitles?.some((lid) => lid.equals(id))
        );
        if (newLinkedIds.length > 0) {
          await Title.findByIdAndUpdate(title._id, {
            $addToSet: { linkedTitles: { $each: newLinkedIds } },
          });
        }

        await delay(5000);
      } catch (error) {
        if (error.response?.status === 429) {
          const retryAfter = error.response?.headers?.["retry-after"];
          const cooldownMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          markRateLimited("anilist", cooldownMs);
          break;
        }
        console.error(`Franchise scan error for ${title.title}:`, error.message);
      }
    }

    if (added > 0) {
      console.log(`Franchise scan: added ${added} new linked titles.`);
    }
  } catch (error) {
    console.error("Franchise scan error:", error.message);
  }
};

const cleanupOldUpdates = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const trailerResult = await Update.deleteMany({
    type: { $in: ["official_trailer_released", "official_teaser_released"] },
    detectedAt: { $lt: sevenDaysAgo },
  });
  if (trailerResult.deletedCount > 0) {
    console.log(`Periodic cleanup: removed ${trailerResult.deletedCount} old trailer updates.`);
  }

  const staleResult = await Update.deleteMany({
    type: { $nin: ["official_trailer_released", "official_teaser_released"] },
    detectedAt: { $lt: sevenDaysAgo },
  });
  if (staleResult.deletedCount > 0) {
    console.log(`Periodic cleanup: removed ${staleResult.deletedCount} stale updates older than 7 days.`);
  }
};

const SYNC_TIMEOUT_MS = 25 * 60 * 1000;

const runSync = async () => {
  if (syncRunning) {
    console.log("Sync already in progress, skipping this cycle.");
    return;
  }
  syncRunning = true;
  const syncStart = Date.now();

  try {
    console.log("Starting sync job...");

    await cleanupOldUpdates();

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const titles = await Title.find({
      $or: [
        { lastSyncedAt: { $exists: false } },
        { lastSyncedAt: { $lt: tenMinutesAgo } },
      ],
    });
    console.log(`Syncing ${titles.length} titles...`);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const title of titles) {
      if (Date.now() - syncStart > SYNC_TIMEOUT_MS) {
        console.log("Sync timeout reached, stopping title sync early.");
        break;
      }
      if ((isRateLimited("anilist") || anilistBreaker.isOpen()) && isRateLimited("tmdb")) {
        console.log("Both APIs rate limited, pausing title sync.");
        break;
      }

      const wasRecentlySynced = title.lastSyncedAt && new Date(title.lastSyncedAt) >= twentyFourHoursAgo;
      const shouldContinue = await syncTitle(title, { detectChanges: wasRecentlySynced });
      if (!shouldContinue) break;
      await delay(4000);
    }

    if (Date.now() - syncStart < SYNC_TIMEOUT_MS && !isRateLimited("youtube")) {
      console.log("Starting trailer sync...");
      const trailerTitles = titles.length > 0 ? titles : await Title.find({});
      for (const title of trailerTitles) {
        if (Date.now() - syncStart > SYNC_TIMEOUT_MS) {
          console.log("Sync timeout reached, stopping trailer sync early.");
          break;
        }
        if (isRateLimited("youtube")) {
          console.log("YouTube rate limited, stopping trailer sync.");
          break;
        }
        const shouldContinue = await syncTrailers(title);
        if (!shouldContinue) break;
        await delay(5000);
      }
    } else if (!isRateLimited("youtube")) {
      console.log("Skipping trailer sync: timeout reached.");
    } else {
      console.log("Skipping trailer sync: YouTube rate limited.");
    }

    if (Date.now() - syncStart < SYNC_TIMEOUT_MS && !isRateLimited("groq")) {
      await syncRSSNews();
      await retryPendingClassifications();
    } else if (!isRateLimited("groq")) {
      console.log("Skipping RSS sync: timeout reached.");
    } else {
      console.log("Skipping RSS sync: Groq rate limited.");
    }

    if (Date.now() - syncStart < SYNC_TIMEOUT_MS) {
      await scanFranchises();
    } else {
      console.log("Skipping franchise scan: timeout reached.");
    }

    const duration = ((Date.now() - syncStart) / 1000).toFixed(1);
    console.log(`Sync job completed in ${duration}s.`);
  } finally {
    syncRunning = false;
  }
};

const WorkerMeta = mongoose.model("WorkerMeta", new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
}));

const getWorkerMeta = async (key) => {
  const doc = await WorkerMeta.findOne({ key });
  return doc?.value;
};

const setWorkerMeta = async (key, value) => {
  await WorkerMeta.findOneAndUpdate(
    { key },
    { key, value, updatedAt: new Date() },
    { upsert: true }
  );
};

const startWorker = async () => {
  await connectDB();
  console.log("Worker started.");

  const reset = process.argv.includes("--reset");
  if (reset) {
    console.log("Reset mode: wiping all updates and notifications...");
    const updateCount = await Update.deleteMany({});
    const notifCount = await Notification.deleteMany({});
    console.log(`Removed ${updateCount.deletedCount} updates and ${notifCount.deletedCount} notifications.`);
    console.log("Reset complete. Exiting without sync — next cron cycle will establish clean baselines.");
    process.exit(0);
  }

  await cleanupOldData();

  const lastBackfill = await getWorkerMeta("lastBackfill");
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (!lastBackfill || new Date(lastBackfill) < oneDayAgo) {
    await backfillEpisodeNumbers();
    await setWorkerMeta("lastBackfill", new Date());
  } else {
    console.log("Backfill already ran within last 24h, skipping.");
  }

  const backfillOnly = process.argv.includes("--backfill-only");
  if (backfillOnly) {
    console.log("Backfill-only mode. Exiting.");
    process.exit(0);
  }

  const once = process.argv.includes("--once");
  if (once) {
    console.log("Once mode: running a single sync cycle.");
    await runSync();
    console.log("Once mode complete. Exiting.");
    process.exit(0);
  }

  const interval = config.cronSyncInterval;
  console.log(`Scheduling sync with cron: ${interval}`);

  cron.schedule(interval, runSync);

  runSync();
};

startWorker();
