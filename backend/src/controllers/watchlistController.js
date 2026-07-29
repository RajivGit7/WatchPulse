import Watchlist from "../models/Watchlist.js";
import Title from "../models/Title.js";

export const getWatchlist = async (req, res, next) => {
  try {
    const watchlist = await Watchlist.find({ user: req.user._id })
      .populate("title")
      .sort({ updatedAt: -1 });

    res.json(watchlist);
  } catch (error) {
    next(error);
  }
};

export const addToWatchlist = async (req, res, next) => {
  try {
    const { titleId, status } = req.body;

    let title = await Title.findById(titleId);
    if (!title) {
      return res.status(404).json({ message: "Title not found" });
    }

    const existingEntry = await Watchlist.findOne({
      user: req.user._id,
      title: titleId,
    });

    if (existingEntry) {
      return res
        .status(400)
        .json({ message: "Title already in watchlist" });
    }

    const watchlistEntry = await Watchlist.create({
      user: req.user._id,
      title: titleId,
      status: status || "planned",
    });

    const populated = await watchlistEntry.populate("title");
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

export const updateWatchlistEntry = async (req, res, next) => {
  try {
    const { status } = req.body;

    const entry = await Watchlist.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status },
      { new: true, runValidators: true }
    ).populate("title");

    if (!entry) {
      return res.status(404).json({ message: "Watchlist entry not found" });
    }

    res.json(entry);
  } catch (error) {
    next(error);
  }
};

export const removeFromWatchlist = async (req, res, next) => {
  try {
    const entry = await Watchlist.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!entry) {
      return res.status(404).json({ message: "Watchlist entry not found" });
    }

    res.json({ message: "Removed from watchlist" });
  } catch (error) {
    next(error);
  }
};
