import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import { config } from "./config/config.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import watchlistRoutes from "./routes/watchlistRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import updateRoutes from "./routes/updateRoutes.js";
import titleRoutes from "./routes/titleRoutes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { message: "Too many requests, please try again later." },
});
app.use("/api", globalLimiter);

const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { message: "Rate limit exceeded for this endpoint." },
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/search", expensiveLimiter, searchRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/updates", updateRoutes);
app.use("/api/titles", titleRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

const PORT = config.port;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

export default app;
