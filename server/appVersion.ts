// Exposes the deployed checkpoint version so the client cache-busting logic
// can compare the build-embedded marker against the server-published version
// and force a hard reload on mismatch (mobile browsers such as Brave/Android
// aggressively cache stale JS/CSS bundles). Production hosting rewrites
// non-/api paths to the SPA index.html, so this lives on an Express route
// rather than a static file.
//
// The version is resolved by server/_core/buildVersion.ts through a chain of
// sources (build-time constant, shipped SPA marker, development file read,
// and a self-derived deploy token) so the endpoint stays reliable in
// production, where client/public is not shipped and the platform pipeline
// does not run the local build script.

import express, { type Express, type Router, type Request, type Response } from "express";
import { readBuildVersion } from "./_core/buildVersion";

// The deployed version is resolved at runtime by
// server/_core/buildVersion.ts. "unknown" is used when no version could be
// determined — the client never triggers reloads for that sentinel.
export function getBuildVersion(): string {
  return readBuildVersion();
}

export function registerAppVersionRoute(app: Express | Router) {
  // The version endpoint lives inside the proxied /api/trpc path space:
  // production hosting only forwards /api/trpc (and /api/oauth) to the Express
  // server, rewriting all other paths to the SPA index.html. The handler is
  // registered on the sub-router mounted at "/api/trpc" BEFORE the tRPC
  // middleware so it wins over tRPC's catch-all sub-path handling, with a
  // route path relative to the mount point.
  (app as Router).get("/app-version", (_req: Request, res: Response) => {
    res.type("json").send({ version: getBuildVersion() });
  });
}
