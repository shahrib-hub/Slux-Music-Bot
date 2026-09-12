/**
 * Emits dist/package.json — a runtime-only package manifest for the backend
 * host (Wispbyte/panel/VPS). The esbuild bundle imports these packages from
 * node_modules at runtime; everything else in the repo's dependencies
 * (next, react, tailwind, etc.) is frontend-only and never needed here.
 *
 * Uploading dist/ (server.js + package.json) keeps the container lean and
 * the panel's `npm install` small — no devDependencies, no frontend tree.
 */
import { readFileSync, writeFileSync } from "node:fs";

const RUNTIME_DEPS = [
  "discord.js",
  "shoukaku",
  "mongoose",
  "socket.io",
  "jose",
  "zod",
  "clsx",
  "tailwind-merge",
];

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const deps = {};
for (const name of RUNTIME_DEPS) {
  if (pkg.dependencies?.[name]) deps[name] = pkg.dependencies[name];
}

const missing = RUNTIME_DEPS.filter((n) => !deps[n]);
if (missing.length > 0) {
  console.error(`[slux] backend-package: missing runtime deps in package.json: ${missing.join(", ")}`);
  process.exit(1);
}

writeFileSync(
  "dist/package.json",
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      private: true,
      type: "module",
      engines: pkg.engines,
      scripts: { start: "node server.js" },
      dependencies: deps,
    },
    null,
    2,
  ) + "\n",
);

console.log(
  `[slux] dist/package.json written (${Object.keys(deps).length} runtime deps) — ` +
    "upload dist/ + .env to the backend host",
);
