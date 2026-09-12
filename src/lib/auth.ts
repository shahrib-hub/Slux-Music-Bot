import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/jwt";

export { SESSION_COOKIE, STATE_COOKIE, signSessionToken, verifySessionToken, discordOAuthUrl, oauthStateSecret, type SessionPayload } from "@/lib/jwt";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export function loginRedirectUrl(): string {
  return `${getEnv().APP_URL}/?auth=login`;
}
