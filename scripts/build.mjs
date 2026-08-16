/**
 * Production build: runs the Vite client build, then bundles the Express
 * server with esbuild, injecting DEPLOYED_VERSION from
 * client/public/__manus__/version.json via --define so the version is baked
 * into dist/index.js without mutating any source file during builds.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import esbuild from "esbuild";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// 1. Vite client build (also patches the client index.html build marker).
execSync("npx vite build", { stdio: "inherit", cwd: ROOT });

// 2. Resolve the deployed version from the platform-written version.json.
let deployedVersion = "unknown";
try {
  const versionJsonPath = path.resolve(
    ROOT,
    "client",
    "public",
    "__manus__",
    "version.json"
  );
  if (fs.existsSync(versionJsonPath)) {
    const published = JSON.parse(fs.readFileSync(versionJsonPath, "utf8"));
    if (typeof published?.version === "string") {
      deployedVersion = published.version;
    }
  }
} catch {
  // Degrade to "unknown".
}

// 3. Bundle the server, injecting the version as a compile-time constant.
await esbuild.build({
  entryPoints: ["server/_core/index.ts"],
  platform: "node",
  packages: "external",
  bundle: true,
  format: "esm",
  outdir: "dist",
  define: {
    DEPLOYED_VERSION: JSON.stringify(deployedVersion),
  },
});
