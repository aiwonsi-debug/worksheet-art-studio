/**
 * Runtime access to the deployed version used by the
 * /api/trpc/app-version endpoint (client cache busting).
 *
 * Resolution order (first match wins):
 * 1. Build-time constant DEPLOYED_VERSION (injected by the local build
 *    script via esbuild --define; the platform pipeline may skip it).
 * 2. The #manus-build-version marker inside the shipped SPA index.html
 *    (dist/public/index.html), mirroring what the client reads.
 * 3. client/public/__manus__/version.json (development only).
 * 4. A self-derived token: the SHA-256 of the running server entry file
 *    (the server bundle itself). It is stable across restarts of the same
 *    deployment and changes whenever new server code is deployed, which is
 *    sufficient for cache busting.
 * 5. "unknown" — the sentinel for which the client never triggers reloads.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

declare const DEPLOYED_VERSION: string | undefined;

const BAKED = typeof DEPLOYED_VERSION === "string" ? DEPLOYED_VERSION : null;

function readMarkerFromFile(filePath: string): string | null {
  try {
    const html = fs.readFileSync(filePath, "utf8");
    const match = html.match(
      /id="manus-build-version"[^>]*>\s*"?([^"]+)"?\s*<\/script>/
    );
    const raw = match?.[1]?.trim();
    if (raw && raw !== "__MANUS_BUILD_VERSION__") return raw;
    return null;
  } catch {
    return null;
  }
}

function readSpaMarker(): string | null {
  return readMarkerFromFile(
    path.resolve(
      import.meta.dirname,
      "..",
      "..",
      "dist",
      "public",
      "index.html"
    )
  );
}

function readVersionJson(): string | null {
  try {
    const versionJsonPath = path.resolve(
      import.meta.dirname,
      "..",
      "..",
      "client",
      "public",
      "__manus__",
      "version.json"
    );
    if (fs.existsSync(versionJsonPath)) {
      const published = JSON.parse(
        fs.readFileSync(versionJsonPath, "utf8")
      ) as { version?: string };
      if (typeof published.version === "string") {
        return published.version;
      }
    }
  } catch {
    // Fall through.
  }
  return null;
}

export function readBuildVersion(): string {
  if (BAKED) return BAKED;
  const json = readVersionJson();
  if (json) return json;
  const spa = readSpaMarker();
  if (spa) return spa;
  // Self-derived deploy token: hash of the server bundle being executed.
  try {
    const entry = process.argv[1];
    if (entry && fs.existsSync(entry)) {
      return crypto
        .createHash("sha256")
        .update(fs.readFileSync(entry))
        .digest("hex")
        .slice(0, 8);
    }
  } catch {
    // Fall through to "unknown".
  }
  return "unknown";
}
