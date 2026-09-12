import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getBot } from "@/lib/bot-singleton";
import { getGuildSettings, updateGuildSettings } from "@/db/repositories/guilds";
import { LOCALES } from "@/i18n";

const patchSchema = z.object({
  prefix: z.string().min(1).max(5).regex(/^\S+$/).optional(),
  language: z.enum(["en", "hi", "es", "fr", "de", "pt"]).optional(),
  djRoles: z.array(z.string().regex(/^\d{17,20}$/)).max(10).optional(),
  botChannels: z.array(z.string().regex(/^\d{17,20}$/)).max(20).optional(),
  defaultVolume: z.number().int().min(0).max(150).optional(),
  defaultAutoplay: z.boolean().optional(),
  default247: z.boolean().optional(),
  idleTimeout: z.number().int().min(0).max(120).optional(),
});

async function userManagesGuild(session: NonNullable<Awaited<ReturnType<typeof getSession>>>, guildId: string): Promise<boolean> {
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) return false;
  const guilds = (await res.json()) as { id: string; owner: boolean; permissions: string }[];
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) return false;
  return guild.owner || (BigInt(guild.permissions) & 0x20n) === 0x20n;
}

export async function GET(_request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { guildId } = await params;

  const bot = getBot();
  const guild = bot?.client.guilds.cache.get(guildId);
  if (!bot || !guild) {
    return NextResponse.json({ error: "bot not in guild" }, { status: 404 });
  }
  if (!(await userManagesGuild(session, guildId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const settings = await getGuildSettings(guildId);
  return NextResponse.json({
    settings,
    guild: {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 128 }),
      roles: guild.roles.cache
        .filter((r) => !r.managed && r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))
        .slice(0, 50),
      textChannels: guild.channels.cache
        .filter((c) => c.type === 0 || c.type === 5)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map((c) => ({ id: c.id, name: c.name })),
      voiceChannels: guild.channels.cache
        .filter((c) => c.isVoiceBased())
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map((c) => ({ id: c.id, name: c.name })),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { guildId } = await params;

  const bot = getBot();
  if (!bot?.client.guilds.cache.has(guildId)) {
    return NextResponse.json({ error: "bot not in guild" }, { status: 404 });
  }
  if (!(await userManagesGuild(session, guildId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const settings = await updateGuildSettings(guildId, parsed.data);
  bot.invalidateGuild(guildId);
  return NextResponse.json({ settings, languages: LOCALES.map((l) => l.code) });
}
