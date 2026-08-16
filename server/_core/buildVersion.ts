/**
 * Runtime access to the deployed checkpoint version used by the
 * /api/trpc/app-version endpoint (client cache busting).
 *
 * - Production: the build script injects DEPLOYED_VERSION via
 *   esbuild --define (read from client/public/__manus__/version.json at
 *   build time), so no runtime file reads are needed — client/public is not
 *   shipped to the production container.
 * - Development: reads client/public/__manus__/version.json at runtime, or
 *   returns "unknown" when it cannot be read.
 */
import fs from "node:fs";
import path from "node:path";

declare const DEPLOYED_VERSION: string | undefined;

const BAKED = typeof DEPLOYED_VERSION === "string" ? DEPLOYED_VERSION : null;

export function readBuildVersion(): string {
  if (BAKED) return BAKED;
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
    // Fall through to "unknown".
  }
  return "unknown";
}
