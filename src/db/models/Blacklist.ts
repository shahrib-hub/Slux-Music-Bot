import mongoose, { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const blacklistSchema = new Schema(
  {
    type: { type: String, enum: ["user", "guild"], required: true },
    targetId: { type: String, required: true },
    reason: { type: String, default: "" },
  },
  { timestamps: true },
);

blacklistSchema.index({ type: 1, targetId: 1 }, { unique: true });

export type BlacklistData = InferSchemaType<typeof blacklistSchema>;
export type BlacklistDoc = HydratedDocument<BlacklistData>;
export const BlacklistModel =
  (mongoose.models.Blacklist as mongoose.Model<BlacklistData>) ??
  model<BlacklistData>("Blacklist", blacklistSchema);

export async function isBlacklisted(
  type: "user" | "guild",
  targetId: string,
): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1) return false;
    const entry = await Promise.race([
      BlacklistModel.findOne({ type, targetId }).lean(),
      new Promise<null>((_, reject) => {
        const timer = setTimeout(() => reject(new Error("database timeout")), 3_000);
        timer.unref?.();
      }),
    ]);
    return entry !== null;
  } catch {
    return false;
  }
}
