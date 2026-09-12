import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBot } from "@/lib/bot-singleton";
import { getEnv } from "@/lib/env";
import { inviteUrl } from "@/lib/invite";

export interface DashboardGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number | null;
  botPresent: boolean;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const fetchGuilds = () =>
    fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      next: { revalidate: 0 },
    });

  let res = await fetchGuilds();
  // Discord access token expired (they live ~7 days): signal 401 so the
  // dashboard can offer a one-click re-login.
  if (res.status === 401) {
    return NextResponse.json({ error: "discord_unauthorized" }, { status: 401 });
  }
  // Transient Discord flake (rate limit / 5xx): one retry after a beat.
  if (!res.ok && res.status !== 400) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await fetchGuilds();
    if (res.status === 401) {
      return NextResponse.json({ error: "discord_unauthorized" }, { status: 401 });
    }
  }
  if (!res.ok) {
    return NextResponse.json({ error: "discord api error" }, { status: 502 });
  }
  const guilds = (await res.json().catch(() => [])) as {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    approximate_member_count?: number;
  }[];

  const bot = getBot();
  const manageable = (Array.isArray(guilds) ? guilds : [])
    .filter((g) => g.owner || (BigInt(g.permissions) & 0x20n) === 0x20n)
    .map<DashboardGuild>((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
      memberCount:
        bot?.client.guilds.cache.get(g.id)?.memberCount ?? g.approximate_member_count ?? null,
      botPresent: !!bot?.client.guilds.cache.has(g.id),
    }))
    .sort((a, b) => Number(b.botPresent) - Number(a.botPresent) || a.name.localeCompare(b.name));

  return NextResponse.json({
    guilds: manageable,
    inviteUrl: inviteUrl(getEnv().DISCORD_CLIENT_ID),
  });
}
