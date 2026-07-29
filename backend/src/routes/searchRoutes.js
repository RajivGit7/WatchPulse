import { Router } from "express";
import { searchTitles } from "../controllers/searchController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/", protect, searchTitles);

export default router;