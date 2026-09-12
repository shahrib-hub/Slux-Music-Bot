import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { PlaylistModel, MAX_PLAYLIST_TRACKS } from "@/db/models/Playlist";

const patchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(256).optional(),
  public: z.boolean().optional(),
  addTrack: z
    .object({
      encoded: z.string(),
      title: z.string(),
      author: z.string(),
      length: z.number(),
      uri: z.string().optional().default(""),
      artwork: z.string().optional().default(""),
      sourceName: z.string().optional().default("unknown"),
      identifier: z.string().optional().default(""),
      isrc: z.string().optional().default(""),
      isStream: z.boolean().optional().default(false),
    })
    .optional(),
  removeTrackIndex: z.number().int().min(1).optional(),
});

async function findOwned(userId: string, id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  return PlaylistModel.findById(id);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const playlist = await findOwned(session.userId, id);
  if (!playlist) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!playlist.public && playlist.ownerId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    playlist: {
      id: playlist._id.toString(),
      name: playlist.name,
      description: playlist.description,
      public: playlist.public,
      tracks: playlist.tracks,
      ownerId: playlist.ownerId,
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const playlist = await findOwned(session.userId, id);
  if (!playlist) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (playlist.ownerId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { name, description, public: isPublic, addTrack, removeTrackIndex } = parsed.data;

  if (name !== undefined) {
    const clash = await PlaylistModel.findOne({ ownerId: session.userId, name, _id: { $ne: playlist._id } });
    if (clash) return NextResponse.json({ error: "playlist exists" }, { status: 409 });
    playlist.name = name;
  }
  if (description !== undefined) playlist.description = description;
  if (isPublic !== undefined) playlist.public = isPublic;

  if (addTrack) {
    if (playlist.tracks.length >= MAX_PLAYLIST_TRACKS) {
      return NextResponse.json({ error: "playlist full" }, { status: 400 });
    }
    playlist.tracks.push({ ...addTrack });
  }
  if (removeTrackIndex !== undefined) {
    if (removeTrackIndex < 1 || removeTrackIndex > playlist.tracks.length) {
      return NextResponse.json({ error: "bad index" }, { status: 400 });
    }
    playlist.tracks.splice(removeTrackIndex - 1, 1);
  }

  await playlist.save();
  return NextResponse.json({
    playlist: {
      id: playlist._id.toString(),
      name: playlist.name,
      description: playlist.description,
      public: playlist.public,
      tracks: playlist.tracks,
      ownerId: playlist.ownerId,
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const playlist = await findOwned(session.userId, id);
  if (!playlist) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (playlist.ownerId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await PlaylistModel.deleteOne({ _id: playlist._id });
  return NextResponse.json({ ok: true });
}
