// Exposes the deployed checkpoint version so the client cache-busting logic
// can compare the build-embedded marker against the server-published version
// and force a hard reload on mismatch (mobile browsers such as Brave/Android
// aggressively cache stale JS/CSS bundles). Production hosting rewrites
// non-/api paths to the SPA index.html, so this lives on an Express route
// rather than a static file. The route reads the same file the build
// plugin embeds (client/public/__manus__/version.json) so both values
// always refer to the same source of truth.

import express, { type Express, type Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";

export function registerAppVersionRoute(app: Express | Router) {
  // Production hosting only forwards /api/trpc (and /api/oauth) to the
  // Express server — all other paths are rewritten to the SPA index.html by
  // the hosting edge. Mount the version endpoint inside the proxied /api/trpc
  // path space (as a plain GET route registered before the tRPC middleware,
  // which only handles its own sub-routes) so the client can reach it in
  // production as GET /api/trpc/app-version.
  // The path is relative to the router's mount point, so callers must mount the
// router at "/api/trpc" (see server/_core/index.ts).
(app as Router).get("/app-version", (_req: Request, res: Response) => {
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
