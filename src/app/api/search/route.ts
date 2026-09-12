import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBot } from "@/lib/bot-singleton";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const bot = getBot();
  if (!bot) return NextResponse.json({ error: "bot unavailable" }, { status: 503 });

  const results = await bot.music.search(query, 10);
  return NextResponse.json({ results });
}
