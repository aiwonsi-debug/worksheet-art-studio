/**
 * Regression tests for the /app-version endpoint: the client cache-busting
 * logic compares the build-embedded version marker against this endpoint, so
 * it must reliably return the deployed checkpoint version as JSON — especially
 * in production, where the hosting edge rewrites non-/api paths to the SPA
 * index.html and static files under /__manus__/ are unreachable.
 */
import express from "express";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerAppVersionRoute } from "./appVersion";

const VERSION_JSON_PATH = path.resolve(
  import.meta.dirname,
  "..",
  "client",
  "public",
  "__manus__",
  "version.json"
);

function expectedVersion(): string | null {
  try {
    const published = JSON.parse(
      fs.readFileSync(VERSION_JSON_PATH, "utf8")
    ) as { version?: string };
    return typeof published.version === "string" ? published.version : null;
  } catch {
    return null;
  }
}

function makeApp() {
  const app = express();
  registerAppVersionRoute(app);
  return app;
}

async function getJson(path: string) {
  const server = http.createServer(makeApp());
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body: safeJson(data),
          })
        );
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
  it("returns JSON with the deployed version from the embedded version.json", async () => {
    const res = await getJson("/app-version");
    expect(res.status).toBe(200);
    expect((res.body as { version: string | null }).version).toBe(
      expectedVersion()
    );
  });

  it("responds with application/json content type", async () => {
    const server = http.createServer(makeApp());
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

  it("returns a null version safely when the version file is missing", async () => {
    const readFileSync = vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("ENOENT");
    });
    try {
      const res = await getJson("/app-version");
      expect(res.status).toBe(200);
      expect((res.body as { version: null }).version).toBeNull();
    } finally {
      readFileSync.mockRestore();
    }
  });

  it("is unaffected by stale-cache query parameters", async () => {
    const res = await getJson(`/app-version?v=${Date.now()}`);
    expect(res.status).toBe(200);
    expect((res.body as { version: string | null }).version).toBe(
      expectedVersion()
    );
  });
});
