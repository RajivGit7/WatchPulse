import User from "../models/User.js";
import Watchlist from "../models/Watchlist.js";
import { invalidateUserCache } from "../middleware/auth.js";

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

export const getProfileStats = async (req, res, next) => {
  try {
    const stats = await Watchlist.aggregate([
      { $match: { user: req.user._id } },
      { $lookup: { from: "titles", localField: "title", foreignField: "_id", as: "titleDoc" } },
      { $unwind: { path: "$titleDoc", preserveNullAndEmptyArrays: false } },
      { $group: { _id: "$titleDoc.type", count: { $sum: 1 } } },
    ]);

    const result = { anime: 0, movie: 0, tv: 0, total: 0 };
    for (const s of stats) {
      if (s._id in result) result[s._id] = s.count;
    }
    result.total = result.anime + result.movie + result.tv;

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { username, email, avatar } = req.body;
    const updates = {};

    if (username) updates.username = username;
    if (email) updates.email = email;
    if (avatar !== undefined) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    invalidateUserCache(req.user._id);

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    });
  } catch (error) {
    next(error);
  }
};
