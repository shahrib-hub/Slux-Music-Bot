import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { PlaylistModel } from "@/db/models/Playlist";

const createSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional().default(""),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const playlists = await PlaylistModel.find({ ownerId: session.userId })
    .select("name description tracks public createdAt updatedAt")
    .lean();
  return NextResponse.json({
    playlists: playlists.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description,
      trackCount: p.tracks?.length ?? 0,
      public: p.public,
      tracks: (p.tracks ?? []).slice(0, 500),
      updatedAt: p.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const { name, description } = parsed.data;
  const exists = await PlaylistModel.findOne({ ownerId: session.userId, name });
  if (exists) {
    return NextResponse.json({ error: "playlist exists" }, { status: 409 });
  }
  const playlist = await PlaylistModel.create({
    ownerId: session.userId,
    name,
    description,
    tracks: [],
  });
  return NextResponse.json({
    playlist: {
      id: playlist._id.toString(),
      name: playlist.name,
      description: playlist.description,
      trackCount: 0,
      public: playlist.public,
      tracks: [],
    },
  });
}
