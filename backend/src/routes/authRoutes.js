import { Router } from "express";
import { register, login, logout } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.post(
  "/register",
  validate({
    username: { required: true, minLength: 3, maxLength: 30 },
    email: { required: true, isEmail: true },
    password: { required: true, minLength: 6 },
  }),
  register
);

router.post(
  "/login",
  validate({
    email: { required: true, isEmail: true },
    password: { required: true },
  }),
  login
);

router.post("/logout", protect, logout);

export default router;
