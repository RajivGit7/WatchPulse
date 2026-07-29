import mongoose from "mongoose";

const titleSchema = new mongoose.Schema(
  {
    externalId: {
      type: String,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["anilist", "tmdb"],
      required: true,
    },
    type: {
      type: String,
      enum: ["anime", "movie", "tv"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    poster: {
      type: String,
      default: "",
    },
    backdrop: {
      type: String,
      default: "",
    },
    releaseStatus: {
      type: String,
      default: "",
    },
    releaseDate: {
      type: Date,
    },
    genres: [String],
    rating: {
      type: Number,
      default: 0,
    },
    episodeCount: {
      type: Number,
      default: 0,
    },
    seasonCount: {
      type: Number,
      default: 0,
    },
    nextEpisodeDate: {
      type: Date,
    },
    nextEpisodeNumber: {
      type: Number,
      default: null,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    franchise: {
      type: String,
      default: "",
      index: true,
    },
    seasonLabel: {
      type: String,
      default: "",
    },
    streamingAvailability: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    linkedTitles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Title",
    }],
    rawData: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

titleSchema.index({ externalId: 1, source: 1 }, { unique: true });

export default mongoose.model("Title", titleSchema);
