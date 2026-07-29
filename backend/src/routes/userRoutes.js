import { Router } from "express";
import { getProfile, getProfileStats, updateProfile } from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/profile", protect, getProfile);
router.get("/profile/stats", protect, getProfileStats);
router.put("/profile", protect, updateProfile);

export default router;
