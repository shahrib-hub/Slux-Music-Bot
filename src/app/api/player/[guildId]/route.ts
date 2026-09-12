import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBot } from "@/lib/bot-singleton";
import { getGuildSettings } from "@/db/repositories/guilds";

export async function GET(_request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { guildId } = await params;

  const bot = getBot();
  if (!bot) return NextResponse.json({ error: "bot unavailable" }, { status: 503 });

  const guild = bot.client.guilds.cache.get(guildId);
  if (!guild) return NextResponse.json({ error: "bot not in guild" }, { status: 404 });

  const player = bot.music.getPlayer(guildId);
  const voiceChannels = guild.channels.cache
    .filter((c) => c.isVoiceBased())
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({ id: c.id, name: c.name }));
  const settings = await getGuildSettings(guildId);

  return NextResponse.json({
    snapshot: player?.snapshot() ?? null,
    voiceChannels,
    guild: { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 128 }) },
    settings: {
      language: settings.language,
      defaultVolume: settings.defaultVolume,
    },
  });
}
