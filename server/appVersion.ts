// Exposes the deployed checkpoint version so the client cache-busting logic
// can compare the build-embedded marker against the server-published version
// and force a hard reload on mismatch (mobile browsers such as Brave/Android
// aggressively cache stale JS/CSS bundles). Production hosting rewrites
// non-/api paths to the SPA index.html, so this lives on an Express route
// rather than a static file. The route reads the same file the build
// plugin embeds (client/public/__manus__/version.json) so both values
// always refer to the same source of truth.

import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";

export function registerAppVersionRoute(app: Express) {
  app.get("/api/app-version", (_req, res) => {
    try {
      const versionJsonPath = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "public",
        "__manus__",
        "version.json"
      );
      let version: string | undefined;
      if (fs.existsSync(versionJsonPath)) {
        const published = JSON.parse(
          fs.readFileSync(versionJsonPath, "utf8")
        ) as { version?: string };
        version = published.version;
      }
      res.type("json").send({ version: typeof version === "string" ? version : null });
    } catch {
      // Even when the embedded version file cannot be read, respond with a
      // well-formed JSON payload (null version). The client treats a missing
      // version field as "no published version" and leaves the page untouched.
      res.type("json").send({ version: null });
    }
  });
}
