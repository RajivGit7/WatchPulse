import { Router } from "express";
import { getCalendar } from "../controllers/calendarController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/", protect, getCalendar);

export default router;
