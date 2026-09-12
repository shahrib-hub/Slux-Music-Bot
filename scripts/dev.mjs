import { spawn } from "node:child_process";
import * as esbuild from "esbuild";

const outfile = "dist/server.dev.js";

// IMPORTANT: the server child must NOT run under `node --watch`.
// Node watch flags propagate to the workers Next.js forks in dev mode, and
// those workers then emit watch-mode IPC messages that jest-worker cannot
// parse — flooding the console with "Unexpected response from worker:
// undefined" on every dynamic-route render. esbuild's watcher below triggers
// managed restarts instead.
let child = null;
let restarting = false;
let restartTimer = null;

function startServer() {
  if (child || restarting) return;
  child = spawn(process.execPath, ["scripts/dev-child.mjs"], {
    stdio: "inherit",
    env: { ...process.env, SLUX_DEV_PARENT: String(process.pid) },
  });
  child.on("exit", () => {
    child = null;
  });
}

function restartServer() {
  if (restarting) return;
  restarting = true;
  const done = () => {
    restarting = false;
    startServer();
  };
  if (child) {
    child.once("exit", done);
    child.kill();
  } else {
    done();
  }
}

function scheduleRestart() {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    restartServer();
  }, 250);
}

let firstBuild = true;
const restartOnChange = {
  name: "slux-restart-on-rebuild",
  setup(build) {
    build.onEnd((result) => {
      if (firstBuild) {
        firstBuild = false;
        return;
      }
      if (result.errors.length > 0) return; // keep old server running on broken build
      scheduleRestart();
    });
  },
};

const ctx = await esbuild.context({
  entryPoints: ["server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  outfile,
  sourcemap: "inline",
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: "info",
  plugins: [restartOnChange],
});

await ctx.rebuild();
startServer();
await ctx.watch();

function shutdown() {
  if (restartTimer) clearTimeout(restartTimer);
  if (child) child.kill();
  void ctx.dispose().then(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", () => {
  if (child) child.kill();
});
