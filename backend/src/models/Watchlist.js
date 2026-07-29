import mongoose from "mongoose";

const watchlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Title",
      required: true,
    },
    status: {
      type: String,
      enum: ["watching", "completed", "planned", "dropped"],
      default: "planned",
    },
  },
  { timestamps: true }
);

watchlistSchema.index({ user: 1, title: 1 }, { unique: true });

export default mongoose.model("Watchlist", watchlistSchema);
