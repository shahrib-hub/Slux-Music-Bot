/**
 * Environment for the frontend (Vercel/Next.js side).
 *
 * The web deployment never needs bot secrets — only the public API URL and
 * the Discord application id (both safe to expose). Keep this separate from
 * the backend `env.ts`, which validates the full bot environment.
 */
export interface WebEnv {
  /** Base URL of the backend (bot + API + socket), e.g. https://bot.example.com */
  apiUrl: string;
  /** Discord application id, for invite links */
  clientId: string;
  /** Public dashboard/dashboard URL (used for links), defaults to this site */
  dashboardUrl: string;
}

export function getWebEnv(): WebEnv {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  const clientId =
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? process.env.DISCORD_CLIENT_ID ?? "";
  const dashboardUrl = (process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "").replace(/\/+$/, "");
  return { apiUrl, clientId, dashboardUrl: dashboardUrl || (apiUrl || "") };
}
