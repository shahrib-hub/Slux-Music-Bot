"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { PlayerSnapshot } from "@/bot/music/types";
import { socketOptions, socketUrl } from "@/lib/api";

export type PlayerAction =
  | { action: "join"; value: string }
  | { action: "play"; value?: string; track?: { encoded: string } }
  | { action: "pause" }
  | { action: "resume" }
  | { action: "toggle" }
  | { action: "skip" }
  | { action: "previous" }
  | { action: "stop" }
  | { action: "seek"; value: number }
  | { action: "volume"; value: number }
  | { action: "loop"; value?: "off" | "track" | "queue" }
  | { action: "shuffle" }
  | { action: "clear" }
  | { action: "remove"; value: number }
  | { action: "moveTop"; value: number }
  | { action: "move"; value: { from: number; to: number } }
  | { action: "autoplay" }
  | { action: "247" }
  | { action: "djmode" }
  | { action: "filter"; value: { name: string; on: boolean; param?: unknown } }
  | { action: "resetFilters" };

export function usePlayerSocket(guildId: string) {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    const socket = io(socketUrl() + "/dashboard", socketOptions);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setError(null);
      socket.emit("guild:join", guildId);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("player:snapshot", (data: PlayerSnapshot) => {
      setSnapshot(data);
      pendingRef.current = false;
    });
    socket.on("connect_error", (err: Error) => {
      setConnected(false);
      setError(err.message);
      // Visible diagnostics: the reason (unauthorized / websocket error /
      // xhr poll error) pinpoints cookie vs proxy vs backend problems.
      console.error("[slux] socket connect_error:", err.message);
    });
    socket.io.on("reconnect_failed", () => setConnected(false));

    return () => {
      socket.emit("guild:leave", guildId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [guildId]);

  const send = useCallback((payload: PlayerAction): Promise<{ ok: boolean; error?: string }> => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      return Promise.resolve({ ok: false, error: "socket disconnected" });
    }
    pendingRef.current = true;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({ ok: false, error: "timeout" }), 8000);
      socket.emit("player:action", { guildId, ...payload }, (result: { ok: boolean; error?: string }) => {
        clearTimeout(timeout);
        resolve(result);
      });
    });
  }, [guildId]);

  return { snapshot, connected, error, send };
}

/** Derived progress in ms, interpolating between snapshot updates. */
export function useProgress(snapshot: PlayerSnapshot | null): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!snapshot?.track) {
      setProgress(0);
      return;
    }
    const base = snapshot.position;
    const startedAt = snapshot.updatedAt;
    const paused = snapshot.paused;
    setProgress(base);

    if (paused || snapshot.track.isStream) return;

    const interval = setInterval(() => {
      setProgress(base + (Date.now() - startedAt));
    }, 500);
    return () => clearInterval(interval);
  }, [snapshot]);

  return progress;
}
