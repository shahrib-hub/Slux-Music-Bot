"use client";

/**
 * Client-side API helpers for the split deployment.
 *
 * The dashboard frontend runs on Vercel while the bot/API runs elsewhere.
 * Set NEXT_PUBLIC_API_URL to the backend URL (e.g. https://bot.example.com);
 * when empty (local same-origin setups) paths stay relative.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

/** Absolute URL for a backend path. */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

/** fetch() against the backend with cookies (session) included. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), { ...init, credentials: "include" });
}

/** Socket.io connection options pointing at the backend. */
export const socketOptions = {
  path: "/socket.io",
  withCredentials: true as const,
  reconnectionAttempts: 8,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
};

/** The backend origin for socket.io client connections ("" = same origin). */
export function socketUrl(): string {
  return API_URL;
}
