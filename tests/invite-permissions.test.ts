import { describe, it, expect } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import { INVITE_PERMISSIONS, inviteUrl } from "@/lib/invite";

/** The full permission set every invite link must request. */
function requiredBits(): bigint {
  return (
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.EmbedLinks |
    PermissionFlagsBits.ReadMessageHistory |
    PermissionFlagsBits.UseExternalEmojis |
    PermissionFlagsBits.ManageMessages |
    PermissionFlagsBits.Connect |
    PermissionFlagsBits.Speak |
    PermissionFlagsBits.UseVAD |
    PermissionFlagsBits.SetVoiceChannelStatus
  );
}

describe("invite permissions", () => {
  it("INVITE_PERMISSIONS matches the OR of the required permission bits", () => {
    expect(INVITE_PERMISSIONS).toBe(requiredBits().toString());
  });

  it("includes the messaging permissions (old website invite lacked them)", () => {
    const value = BigInt(INVITE_PERMISSIONS);
    for (const bit of [
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ReadMessageHistory,
    ]) {
      expect((value & bit) === bit).toBe(true);
    }
  });

  it("includes the Set Voice Channel Status bit (channel-status feature)", () => {
    expect((BigInt(INVITE_PERMISSIONS) & PermissionFlagsBits.SetVoiceChannelStatus) !== 0n).toBe(true);
  });

  it("includes UseVAD (old bot invite lacked it)", () => {
    expect((BigInt(INVITE_PERMISSIONS) & PermissionFlagsBits.UseVAD) !== 0n).toBe(true);
  });

  it("builds a valid invite URL", () => {
    const url = inviteUrl("1234567890");
    expect(url).toBe(
      "https://discord.com/oauth2/authorize?client_id=1234567890&scope=bot+applications.commands&permissions=" +
        INVITE_PERMISSIONS,
    );
  });
});
