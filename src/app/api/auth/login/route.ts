import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { discordOAuthUrl, oauthStateSecret, STATE_COOKIE } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export async function GET() {
  const env = getEnv();
  const state = oauthStateSecret();
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(discordOAuthUrl(state));
}
