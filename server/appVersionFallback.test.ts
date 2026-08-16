/**
 * Regression test for the unknown-version fallback: when the build cannot
 * determine a published checkpoint version (e.g. the platform writes
 * client/public/__manus__/version.json after the Vite build), the server-side
 * module reports "unknown" and the endpoint responds safely. This file lives
 * separately so its module-level mock cannot leak into appVersion.test.ts.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/buildVersion", () => ({
  GENERATED_VERSION: "unknown",
  readBuildVersion: () => "unknown",
}));

describe("appVersion unknown fallback", () => {
  it("reports 'unknown' when the build could not determine a version", async () => {
    const { getBuildVersion } = await import("./appVersion");
    expect(getBuildVersion()).toBe("unknown");
  });
});
