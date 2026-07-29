import { Router } from "express";
import { createOrUpdateTitle, getTitleById } from "../controllers/titleController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/:id", protect, getTitleById);
router.post("/", protect, createOrUpdateTitle);

export default router;