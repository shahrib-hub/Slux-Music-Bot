import type { NodeOption } from "shoukaku";
import { getEnv } from "@/lib/env";

/**
 * Shoukaku node options derived from the LAVALINK_* env block.
 *
 * Always includes the main 3rd-party node. When LAVALINK_BACKUP_HOST is set,
 * a backup node is added — Shoukaku picks the healthiest connected node by
 * penalties (player count, CPU load), so the backup automatically takes over
 * when the main node is offline or busy, and players migrate with
 * `moveOnDisconnect`.
 */
export function lavalinkNodeOptions(): NodeOption[] {
  const env = getEnv();
  const nodes: NodeOption[] = [
    {
      name: env.LAVALINK_NAME,
      url: `${env.LAVALINK_HOST}:${env.LAVALINK_PORT}`,
      auth: env.LAVALINK_PASS,
      secure: env.LAVALINK_SECURE,
    },
  ];

  if (env.LAVALINK_BACKUP_HOST) {
    nodes.push({
      name: env.LAVALINK_BACKUP_NAME,
      url: `${env.LAVALINK_BACKUP_HOST}:${env.LAVALINK_BACKUP_PORT ?? (env.LAVALINK_BACKUP_SECURE ? 443 : 2333)}`,
      auth: env.LAVALINK_BACKUP_PASS || env.LAVALINK_PASS,
      secure: env.LAVALINK_BACKUP_SECURE,
    });
  }

  return nodes;
}
