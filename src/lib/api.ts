"use client";

import type { ManagerOptions } from "socket.io-client";

/**
 * Client-side API helpers.
 *
 * Default (empty NEXT_PUBLIC_API_URL): SAME-ORIGIN paths — the dashboard is
 * deployed on Vercel and `vercel.json` rewrites proxy /api/* and /socket.io/*
 * to the backend (Wispbyte/any host). All requests stay same-origin, so
 * cookies and websockets just work.
 *
 * Set NEXT_PUBLIC_API_URL only for direct-connection setups (local dev does
 * this automatically with http://localhost:3001).
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

/** Socket.io connection options.
 *
 * WebSocket-only transport: socket.io's default flow starts with HTTP
 * long-polling and upgrades later, but long-poll requests get cut by the
 * Vercel rewrite proxy — the connection flaps or dies while REST works.
 * A pure websocket upgrade is proxied reliably by Vercel rewrites.
 *
 * Unlimited reconnection: a backend restart (e.g. panel reboot) can outlast
 * a bounded attempt budget — without this the socket stays dead until the
 * page is refreshed. */
export const socketOptions: Partial<ManagerOptions> = {
  path: "/socket.io",
  withCredentials: true,
  transports: ["websocket"],
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
};

/** The backend origin for socket.io client connections ("" = same origin). */
export function socketUrl(): string {
  return API_URL;
}
