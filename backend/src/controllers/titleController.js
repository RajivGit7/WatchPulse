import Title from "../models/Title.js";

const saveTitle = async (data) => {
  const {
    externalId, source, type, title, franchise, seasonLabel,
    description, poster, backdrop, releaseStatus, releaseDate,
    genres, rating, episodeCount, seasonCount, nextEpisodeDate,
  } = data;

  if (!externalId || !source || !title || !type) return null;

  let existing = await Title.findOne({ externalId, source });

  if (existing) {
    existing.title = title;
    existing.franchise = franchise || existing.franchise;
    existing.seasonLabel = seasonLabel || existing.seasonLabel;
    existing.description = description || existing.description;
    existing.poster = poster || existing.poster;
    existing.backdrop = backdrop || existing.backdrop;
    existing.releaseStatus = releaseStatus || existing.releaseStatus;
    existing.releaseDate = releaseDate || existing.releaseDate;
    existing.genres = genres || existing.genres;
    existing.rating = rating || existing.rating;
    existing.episodeCount = episodeCount || existing.episodeCount;
    existing.seasonCount = seasonCount || existing.seasonCount;
    existing.nextEpisodeDate = nextEpisodeDate || existing.nextEpisodeDate;
    await existing.save();
    return existing;
  }

  return Title.create({
    externalId, source, type, title, franchise, seasonLabel,
    description, poster, backdrop, releaseStatus, releaseDate,
    genres, rating, episodeCount, seasonCount, nextEpisodeDate,
  });
};

export const createOrUpdateTitle = async (req, res, next) => {
  try {
    const { relatedEntries, ...titleData } = req.body;

    if (!titleData.externalId || !titleData.source || !titleData.title || !titleData.type) {
      return res
        .status(400)
        .json({ message: "externalId, source, title, and type are required" });
    }

    const primaryTitle = await saveTitle(titleData);

    const linkedIds = [];
    if (relatedEntries && relatedEntries.length > 0) {
      for (const entry of relatedEntries) {
        const saved = await saveTitle({
          ...entry,
          source: titleData.source,
          type: "anime",
          franchise: titleData.franchise,
        });
        if (saved) linkedIds.push(saved._id);
      }
      primaryTitle.linkedTitles = linkedIds;
      await primaryTitle.save();
    }

    res.status(201).json({ ...primaryTitle.toObject(), linkedTitles: linkedIds });
  } catch (error) {
    next(error);
  }
};

export const getTitleById = async (req, res, next) => {
  try {
    const title = await Title.findById(req.params.id).populate("linkedTitles");
    if (!title) {
      return res.status(404).json({ message: "Title not found" });
    }
    res.json(title);
  } catch (error) {
    next(error);
  }
};