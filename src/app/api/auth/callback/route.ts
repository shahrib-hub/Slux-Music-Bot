import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signSessionToken, SESSION_COOKIE, STATE_COOKIE } from "@/lib/auth";
import { getEnv } from "@/lib/env";

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(`${env.APP_URL}/?auth=failed`);
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${env.APP_URL}/api/auth/callback`,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed (${tokenRes.status})`);
    const tokenData = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) throw new Error(`user fetch failed (${userRes.status})`);
    const user = (await userRes.json()) as DiscordUser;

    const jwt = await signSessionToken({
      userId: user.id,
      username: user.username,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
        : "",
      accessToken: tokenData.access_token,
    });

    const response = NextResponse.redirect(`${env.APP_URL}/dashboard`);
    response.cookies.set(SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("[slux] OAuth callback error:", err);
    return NextResponse.redirect(`${env.APP_URL}/?auth=failed`);
  }
}
