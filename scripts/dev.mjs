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
    env: {
      ...process.env,
      // Backend owns port 3001 in the split dev setup (Next dev uses 3000)
      PORT: "3001",
      SLUX_DEV_PARENT: String(process.pid),
    },
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

// Frontend: Next dev server on :3000, pointed at the backend on :3001.
const web = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3000"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_API_URL: "http://localhost:3001",
  },
});

function shutdown() {
  if (restartTimer) clearTimeout(restartTimer);
  if (child) child.kill();
  web.kill();
  void ctx.dispose().then(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", () => {
  if (child) child.kill();
  web.kill();
});
