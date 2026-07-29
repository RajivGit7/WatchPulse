import Watchlist from "../models/Watchlist.js";
import Update from "../models/Update.js";
import Title from "../models/Title.js";

export const getDashboard = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const watchlistEntries = await Watchlist.find({ user: req.user._id }).populate("title");
    const titleIds = watchlistEntries.map((entry) => entry.title?._id).filter(Boolean);

    const activeFilter = {
      title: { $in: titleIds },
      $or: [{ status: "active" }, { status: { $exists: false } }],
    };

    const [updates, totalCount] = await Promise.all([
      Update.find(activeFilter)
        .populate("title")
        .sort({ detectedAt: -1 })
        .skip(skip)
        .limit(limit),
      Update.countDocuments(activeFilter),
    ]);

    const deduplicatedUpdates = [];
    const seenKeys = new Set();
    for (const update of updates) {
      const titleId = update.title?._id?.toString() || update.title?.toString();
      const key = `${titleId}:${update.type}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      deduplicatedUpdates.push(update);
    }

    const watchedTitles = watchlistEntries
      .map((e) => e.title)
      .filter(Boolean);
    const franchises = [
      ...new Set(
        watchedTitles.filter((t) => t.franchise).map((t) => t.franchise)
      ),
    ];

    let relatedTitles = [];
    if (franchises.length > 0) {
      relatedTitles = await Title.find({
        franchise: { $in: franchises },
        _id: { $nin: titleIds },
      }).limit(20);
    }

    res.json({
      updates: deduplicatedUpdates,
      relatedTitles,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + limit < totalCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
