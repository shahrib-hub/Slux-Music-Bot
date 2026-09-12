import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";

export interface SessionPayload {
  userId: string;
  username: string;
  avatar: string;
  accessToken: string;
}

export const SESSION_COOKIE = "slux_session";
export const STATE_COOKIE = "slux_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function secret(): Uint8Array {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, secret());
  return payload as unknown as SessionPayload;
}

export function discordOAuthUrl(state: string): string {
  const env = getEnv();
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: `${env.APP_URL}/api/auth/callback`,
    response_type: "code",
    scope: "identify email guilds",
    state,
    prompt: "none",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export function oauthStateSecret(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
