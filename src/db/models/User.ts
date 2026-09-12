import mongoose, { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const userSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    language: { type: String, enum: ["en", "hi", "es", "fr", "de", "pt"], default: "en" },
    defaultVolume: { type: Number, min: 0, max: 150, default: 100 },
  },
  { timestamps: true },
);

export type UserData = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserData>;
export const UserModel =
  (mongoose.models.User as mongoose.Model<UserData>) ?? model<UserData>("User", userSchema);
