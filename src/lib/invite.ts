/**
 * OAuth invite permissions shared by the website, dashboard and bot.
 *
 * Bits (BigInt OR of discord.js PermissionFlagsBits):
 *   ViewChannel | SendMessages | EmbedLinks | ReadMessageHistory |
 *   UseExternalEmojis | ManageMessages | Connect | Speak | UseVAD |
 *   SetVoiceChannelStatus
 *
 * "Set Voice Channel Status" is required for the channel-status feature
 * (shows the current song under the voice channel name).
 *
 * NOTE: keep in sync with the test asserting this value against the named
 * bits (tests/invite-permissions.test.ts).
 */
export const INVITE_PERMISSIONS = "281475013766144";

export function inviteUrl(clientId: string): string {
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot+applications.commands&permissions=${INVITE_PERMISSIONS}`;
}
