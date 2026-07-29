import mongoose from "mongoose";

const updateSchema = new mongoose.Schema(
  {
    title: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Title",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "episode_released",
        "movie_released",
        "season_released",
        "season_confirmed",
        "release_date_announced",
        "release_date_changed",
        "release_delayed",
        "official_trailer_released",
        "official_teaser_released",
        "official_poster_released",
        "streaming_platform_changed",
      ],
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ["active", "pending_classification"],
      default: "active",
    },
    priority: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      default: "medium",
    },
    detectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

updateSchema.index({ title: 1, detectedAt: -1 });
updateSchema.index({ status: 1, detectedAt: 1 });

export default mongoose.model("Update", updateSchema);
