/**
 * Refuse to ship a Judge Mode bundle that could launch a task.
 *
 * `canLaunchTasks` is a compile-time constant, so a readonly build should have
 * had the entire `createTask` request body eliminated as dead code rather than
 * merely guarded at runtime. This asserts that actually happened: a guard that
 * silently stopped being applied would otherwise ship a bundle whose only
 * protection is a boolean someone can flip in a debugger.
 *
 * Run against the built output, and fail the image build rather than the
 * deploy:
 *
 *     node scripts/verify-judge-bundle.mjs dist
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2] ?? "dist";
const assets = join(dist, "assets");

const bundles = readdirSync(assets).filter((name) => name.endsWith(".js"));
if (bundles.length === 0) {
  console.error(`verify-judge-bundle: no JS bundle found in ${assets}`);
  process.exit(1);
}

const failures = [];

for (const name of bundles) {
  const source = readFileSync(join(assets, name), "utf8");

  // The API client's write, in minified form. Any of these means the request
  // survived the build.
  for (const pattern of [
    /method\s*:\s*["']POST["']/,
    /method\s*:\s*["']PUT["']/,
    /method\s*:\s*["']PATCH["']/,
    /method\s*:\s*["']DELETE["']/,
  ]) {
    if (pattern.test(source)) {
      failures.push(`${name}: bundle still builds a request with ${pattern}`);
    }
  }

  for (const route of ["/tasks/scout", "/tasks/investigate", "/tasks/finalize"]) {
    if (source.includes(route)) {
      failures.push(`${name}: bundle references the internal task route ${route}`);
    }
  }

  if (!source.includes("Launching tasks is disabled in this build")) {
    failures.push(`${name}: createTask is not the read-only rejection stub`);
  }
}

const index = readFileSync(join(dist, "index.html"), "utf8");
if (!index.includes("<div id=\"root\"")) {
  failures.push("index.html does not look like the built interface shell");
}

if (failures.length > 0) {
  console.error("verify-judge-bundle: FAILED\n  - " + failures.join("\n  - "));
  process.exit(1);
}

console.log(
  `verify-judge-bundle: OK — ${bundles.length} bundle(s) contain no write request`,
);
