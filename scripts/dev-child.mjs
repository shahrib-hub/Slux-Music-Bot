// Dev child entry: exits if the dev.mjs parent dies, then runs the server.
// This prevents orphaned server processes from holding port 3000 when the
// parent is force-killed (e.g. by task managers or CI runners).
const ppid = Number(process.env.SLUX_DEV_PARENT ?? 0);
if (ppid > 0) {
  const watchdog = setInterval(() => {
    try {
      process.kill(ppid, 0);
    } catch {
      clearInterval(watchdog);
      process.exit(0);
    }
  }, 2000);
  watchdog.unref();
}

// Strip any node --watch* flags from NODE_OPTIONS before Next.js boots:
// Next's dev workers inherit them and their watch-mode IPC messages crash
// jest-worker ("Unexpected response from worker: undefined" floods).
if (process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS.split(/\s+/)
    .filter((arg) => !arg.startsWith("--watch"))
    .join(" ")
    .trim();
  if (!process.env.NODE_OPTIONS) delete process.env.NODE_OPTIONS;
}

await import("../dist/server.dev.js");
