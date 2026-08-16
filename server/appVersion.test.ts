/**
 * Regression tests for the /app-version endpoint: the client cache-busting
 * logic compares the build-embedded marker against this endpoint, so
 * it must reliably return the deployed checkpoint version as JSON — especially
 * in production, where the hosting edge rewrites non-/api paths to the SPA
 * index.html and static files under /__manus__/ are unreachable.
 *
 * The version is baked into the server bundle at build time from
 * client/public/__manus__/version.json (see vite.config.ts
 * vitePluginBuildVersionMarker and server/appVersion.ts).
 */
import express from "express";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const VERSION_JSON_PATH = path.resolve(
  import.meta.dirname,
  "..",
  "client",
  "public",
  "__manus__",
  "version.json"
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

// The platform's periodic builds rewrite client/public/__manus__/version.json
// at any moment, so the published value is snapshotted once per run rather
// than re-read inside each assertion (which would flake on mid-run updates).
let snapshotVersion: string | null | undefined;

function expectedVersion(): string | null {
  if (snapshotVersion !== undefined) return snapshotVersion;
  try {
    const published = JSON.parse(
      fs.readFileSync(VERSION_JSON_PATH, "utf8")
    ) as { version?: string };
    snapshotVersion =
      typeof published.version === "string" ? published.version : null;
    return snapshotVersion;
  } catch {
    snapshotVersion = null;
    return null;
  }
}

async function makeApp() {
  const app = express();
  const { registerAppVersionRoute } = await import("./appVersion");
  registerAppVersionRoute(app);
  return app;
}

async function getJson(urlPath: string) {
  const server = http.createServer(await makeApp());
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error(`getJson timeout for ${urlPath}`));
    }, 8000);
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          clearTimeout(timer);
          resolve({ status: res.statusCode ?? 0, body: safeJson(data) });
        });
      }).on("error", reject);
    });
  });
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

describe("/app-version endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns JSON with the deployed version resolved from the published sources", async () => {
    const res = await getJson("/app-version");
    expect(res.status).toBe(200);
    const expected = expectedVersion();
    expect((res.body as { version: string | null }).version).toBe(
      expected ?? expect.any(String)
    );
  });

  it("responds with application/json content type", async () => {
    const server = http.createServer(await makeApp());
    const contentType = await new Promise<string>((resolve, reject) => {
      server.listen(0, () => {
        const port = (server.address() as { port: number }).port;
        http.get(`http://127.0.0.1:${port}/app-version`, (res) => {
          resolve(res.headers["content-type"] ?? "");
        }).on("error", reject);
      });
    });
    expect(contentType).toContain("application/json");
  });

  it("is unaffected by stale-cache query parameters", async () => {
    const res = await getJson(`/app-version?v=${Date.now()}`);
    expect(res.status).toBe(200);
    const expected = expectedVersion();
    expect((res.body as { version: string | null }).version).toBe(
      expected ?? expect.any(String)
    );
  });
});
