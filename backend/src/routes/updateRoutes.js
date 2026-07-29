import { Router } from "express";
import { protect } from "../middleware/auth.js";
import Update from "../models/Update.js";

const router = Router();

router.get("/:titleId/history", protect, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const historyFilter = {
      title: req.params.titleId,
      $or: [{ status: "active" }, { status: { $exists: false } }],
    };

    const [updates, totalCount] = await Promise.all([
      Update.find(historyFilter)
        .sort({ detectedAt: -1 })
        .skip(skip)
        .limit(limit),
      Update.countDocuments(historyFilter),
    ]);

    res.json({
      updates,
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
});

export default router;
