/**
 * @vitest-environment jsdom
 *
 * Regression tests for the mobile cache-busting mechanism: the app compares
 * the build-embedded version marker against the server-published
 * /__manus__/version.json on boot and hard-reloads when they differ, so
 * Brave/Android users with aggressively cached bundles get the fresh build.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { enforceFreshBundle, readBuildVersion } from "./cacheBust";

vi.stubGlobal(
  "location",
  Object.create(window.location, {
    reload: { value: vi.fn(), writable: true },
  })
);

const reload = () => vi.mocked(window.location.reload);

function makeFetch(body: string, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(body),
  } as unknown as Response) as unknown as typeof fetch;
}

beforeEach(() => {
  reload().mockReset();
});

describe("enforceFreshBundle (mobile cache busting)", () => {
  it("reloads when the server publishes a newer version", async () => {
    const fetchImpl = makeFetch(JSON.stringify({ version: "abc12345" }));
    await enforceFreshBundle("oldver12", fetchImpl);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the published version matches the build", async () => {
    const fetchImpl = makeFetch(JSON.stringify({ version: "abc12345" }));
    await enforceFreshBundle("abc12345", fetchImpl);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("does not reload when the version endpoint is unavailable", async () => {
    const fetchImpl = makeFetch("{}", 404);
    await enforceFreshBundle("oldver12", fetchImpl);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("does not reload when the network request throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    await enforceFreshBundle("oldver12", fetchImpl as unknown as typeof fetch);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("does not reload when the version field is missing from the payload", async () => {
    const fetchImpl = makeFetch(JSON.stringify({ timestamp: 123 }));
    await enforceFreshBundle("oldver12", fetchImpl);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("reloads for any differing published version string", async () => {
    const fetchImpl = makeFetch(JSON.stringify({ version: "different" }));
    await enforceFreshBundle("build-v2", fetchImpl);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});

describe("readBuildVersion", () => {
  it("returns null when no build marker exists", () => {
    document.getElementById("manus-build-version")?.remove();
    expect(readBuildVersion()).toBeNull();
  });

  it("parses the injected JSON build marker", () => {
    let el = document.getElementById("manus-build-version");
    if (!el) {
      el = document.createElement("script");
      el.id = "manus-build-version";
      document.body.appendChild(el);
    }
    el.textContent = '"checkpoint-abc123"';
    expect(readBuildVersion()).toBe("checkpoint-abc123");
    el.remove();
  });

  it("falls back to the legacy window global when no marker element exists", () => {
    document.getElementById("manus-build-version")?.remove();
    (window as unknown as { __MANUS_BUILD_VERSION__?: string }).__MANUS_BUILD_VERSION__ =
      "legacy-version";
    expect(readBuildVersion()).toBe("legacy-version");
    delete (window as unknown as { __MANUS_BUILD_VERSION__?: string })
      .__MANUS_BUILD_VERSION__;
  });

  it("returns null when the marker JSON is malformed", () => {
    let el = document.getElementById("manus-build-version");
    if (!el) {
      el = document.createElement("script");
      el.id = "manus-build-version";
      document.body.appendChild(el);
    }
    el.textContent = "not-json{";
    expect(readBuildVersion()).toBeNull();
    el.remove();
  });
});
