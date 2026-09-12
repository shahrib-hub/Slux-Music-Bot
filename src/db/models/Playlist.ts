import mongoose, { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export const MAX_PLAYLIST_TRACKS = 1000;

const playlistTrackSchema = new Schema(
  {
    encoded: { type: String, required: true },
    title: { type: String, required: true },
    author: { type: String, required: true },
    length: { type: Number, required: true },
    uri: { type: String, default: "" },
    artwork: { type: String, default: "" },
    sourceName: { type: String, default: "unknown" },
    isrc: { type: String, default: "" },
    identifier: { type: String, default: "" },
    isStream: { type: Boolean, default: false },
  },
  { _id: false },
);

const playlistSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    guildId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 64 },
    description: { type: String, default: "", maxlength: 256 },
    tracks: { type: [playlistTrackSchema], default: [] },
    public: { type: Boolean, default: false },
  },
  { timestamps: true },
);

playlistSchema.index({ ownerId: 1, name: 1 }, { unique: true });

export type PlaylistTrack = InferSchemaType<typeof playlistTrackSchema> & { encoded: string };
export type PlaylistData = InferSchemaType<typeof playlistSchema>;
export type PlaylistDoc = HydratedDocument<PlaylistData>;

export const PlaylistModel =
  (mongoose.models.Playlist as mongoose.Model<PlaylistData>) ??
  model<PlaylistData>("Playlist", playlistSchema);
