import { PermissionFlagsBits, type GuildMember, type Guild } from "discord.js";
import type { GuildData } from "@/db/models/Guild";
import type { GuildPlayer } from "@/bot/music/GuildPlayer";

export function isDJ(member: GuildMember | null, settings: GuildData, player?: GuildPlayer): boolean {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  if (settings.djRoles.length > 0 && member.roles.cache.some((r) => settings.djRoles.includes(r.id))) {
    return true;
  }
  // Sole listener bypass
  if (player) {
    const channel = player.voiceChannel;
    if (channel) {
      const humans = channel.members.filter((m) => !m.user.bot);
      if (humans.size <= 1) return true;
    }
  }
  return false;
}

export function isAloneListener(member: GuildMember | null, player: GuildPlayer): boolean {
  if (!member) return false;
  const channel = player.voiceChannel;
  if (!channel) return false;
  const humans = channel.members.filter((m) => !m.user.bot);
  return humans.has(member.id);
}

export function canControl(member: GuildMember | null, settings: GuildData, player: GuildPlayer): boolean {
  // DJ mode: only listeners in voice can control
  if (player.djMode && !isAloneListener(member, player) && !isDJ(member, settings, player)) {
    return false;
  }
  return true;
}

export function botChannelAllowed(guild: Guild, settings: GuildData, channelId: string): boolean {
  if (settings.botChannels.length === 0) return true;
  return settings.botChannels.includes(channelId);
}

export function manageGuild(member: GuildMember | null): boolean {
  return !!member?.permissions.has(PermissionFlagsBits.ManageGuild);
}
