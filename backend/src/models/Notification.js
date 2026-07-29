import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
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
    update: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Update",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      default: "medium",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
