// Mobile-browser cache busting: Brave/Android often serve a stale JS/CSS
// bundle after a new deployment (aggressive HTTP caching). The deployed
// checkpoint version is exposed by GET /api/trpc/app-version (see
// server/appVersion.ts); the HTML may also carry a build-time marker, but the
// platform pipeline can leave it uninjected, so the client treats a missing
// marker as "no known build" and reloads whenever the server publishes a
// version we have not seen yet.
//
// Reload-loop guard: once a reload happens for a given server version, the
// session records it so repeated page loads do not trigger further reloads
// for the same version (a mismatch after reload indicates a real problem,
// not staleness).

const RELOADED_VERSION_KEY = "paperloom-reloaded-version";

export function readBuildVersion(): string | null {
  if (typeof document === "undefined") return null;
  // Injected at build time by client/index.html (#manus-build-version). The
  // platform pipeline may leave the placeholder value in place, so a
  // placeholder string is treated the same as a missing marker.
  const marker = document.getElementById("manus-build-version")?.textContent;
  if (marker) {
    try {
      const parsed = JSON.parse(marker) as unknown;
      if (
        typeof parsed === "string" &&
        parsed !== "__MANUS_BUILD_VERSION__"
      ) {
        return parsed;
      }
    } catch {
      // malformed marker — fall through
    }
  }
  const legacy = (window as unknown as { __MANUS_BUILD_VERSION__?: string })
    .__MANUS_BUILD_VERSION__;
  return typeof legacy === "string" && legacy !== "__MANUS_BUILD_VERSION__"
    ? legacy
    : null;
}

function alreadyReloadedFor(version: string): boolean {
  try {
    return sessionStorage.getItem(RELOADED_VERSION_KEY) === version;
  } catch {
    // sessionStorage unavailable (privacy mode) — allow the reload.
    return false;
  }
}

function markReloadedFor(version: string) {
  try {
    sessionStorage.setItem(RELOADED_VERSION_KEY, version);
  } catch {
    // sessionStorage unavailable — degradation only.
  }
}

export async function enforceFreshBundle(
  buildVersion: string | null,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): Promise<void> {
  // Production hosting rewrites non-/api paths (including
  // /__manus__/version.json) to the SPA index.html, and only forwards
  // /api/trpc (plus /api/oauth) to the Express server, so the deployed
  // version is exposed through GET /api/trpc/app-version (see
  // server/appVersion.ts), mounted inside the proxied path space.
  try {
    const res = await fetchImpl(`/api/trpc/app-version?v=${Date.now()}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { version?: string };
    const serverVersion =
      typeof data.version === "string" && data.version !== "unknown"
        ? data.version
        : null;
    if (!serverVersion) return;
    // Unknown or mismatched build: fetch the fresh deployment. Guard against
    // reload loops by skipping when we already reloaded for this version.
    if (buildVersion !== serverVersion && !alreadyReloadedFor(serverVersion)) {
      markReloadedFor(serverVersion);
      window.location.reload();
    }
  } catch {
    // Network or parse failure — leave the current page untouched.
  }
}
