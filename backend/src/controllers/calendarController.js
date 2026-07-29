import Watchlist from "../models/Watchlist.js";

export const getCalendar = async (req, res, next) => {
  try {
    const watchlistEntries = await Watchlist.find({ user: req.user._id }).populate("title");

    const calendarEvents = watchlistEntries
      .filter((entry) => entry.title)
      .map((entry) => entry.title)
      .filter((title) => title.nextEpisodeDate || title.releaseDate)
      .filter((title) => {
        const date = title.nextEpisodeDate || title.releaseDate;
        return new Date(date) >= new Date();
      })
      .map((title) => ({
        id: title._id,
        title: title.title,
        type: title.type,
        poster: title.poster,
        date: title.nextEpisodeDate || title.releaseDate,
      }));

    res.json(calendarEvents);
  } catch (error) {
    next(error);
  }
};
