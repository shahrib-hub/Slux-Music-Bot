import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBot } from "@/lib/bot-singleton";

export async function GET(_request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { guildId } = await params;

  const bot = getBot();
  if (!bot) return NextResponse.json({ error: "bot unavailable" }, { status: 503 });

  // Cached session→query lookup for the current track, so the dashboard can
  // poll safely without hammering the lyrics providers.
  const player = bot.music.getPlayer(guildId);
  const current = player?.current ?? null;
  if (!current) return NextResponse.json({ lyrics: null });

  const lyrics = await bot.music.lyricsForTrack(guildId, {
    title: current.title,
    author: current.author,
  });
  return NextResponse.json({ lyrics });
}
