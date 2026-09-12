import { NextResponse } from "next/server";
import { getBot } from "@/lib/bot-singleton";
import { COMMAND_COUNT } from "@/lib/command-catalog";

export async function GET() {
  const bot = getBot();
  let servers = 0;
  let players = 0;
  let users = 0;
  if (bot) {
    servers = bot.client.guilds.cache.size;
    players = bot.music.stats().players;
    for (const guild of bot.client.guilds.cache.values()) {
      users += guild.memberCount ?? 0;
    }
  }
  return NextResponse.json({
    servers,
    players,
    users,
    commands: COMMAND_COUNT,
    uptime: bot?.uptimeSeconds ?? 0,
  });
}
