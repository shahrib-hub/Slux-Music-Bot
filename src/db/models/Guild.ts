import mongoose, { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const guildSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    prefix: { type: String, default: "!" },
    language: {
      type: String,
      enum: ["en", "hi", "es", "fr", "de", "pt"],
      default: "en",
    },
    djRoles: { type: [String], default: [] },
    botChannels: { type: [String], default: [] },
    defaultVolume: { type: Number, min: 0, max: 150, default: 100 },
    defaultAutoplay: { type: Boolean, default: false },
    default247: { type: Boolean, default: false },
    idleTimeout: { type: Number, min: 0, max: 120, default: 5 },
    /** True once the welcome/thanks message was sent for this guild. */
    welcomed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type GuildData = InferSchemaType<typeof guildSchema>;
export type GuildDoc = HydratedDocument<GuildData>;
export const GuildModel =
  (mongoose.models.Guild as mongoose.Model<GuildData>) ?? model<GuildData>("Guild", guildSchema);
