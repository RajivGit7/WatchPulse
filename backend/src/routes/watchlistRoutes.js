import { Router } from "express";
import {
  getWatchlist,
  addToWatchlist,
  updateWatchlistEntry,
  removeFromWatchlist,
} from "../controllers/watchlistController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/", protect, getWatchlist);
router.post("/", protect, addToWatchlist);
router.patch("/:id", protect, updateWatchlistEntry);
router.delete("/:id", protect, removeFromWatchlist);

export default router;
