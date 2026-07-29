import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/", protect, getNotifications);
router.patch("/read-all", protect, markAllAsRead);
router.patch("/:id/read", protect, markAsRead);

export default router;
