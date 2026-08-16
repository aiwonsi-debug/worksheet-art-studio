// Mobile-browser cache busting: Brave/Android often serve a stale JS/CSS
// bundle after a new deployment (aggressive HTTP caching). The build embeds
// the current checkpoint version (see client/index.html); if the server-
// published version.json shows a different deployment, force a hard reload
// so users always get the fresh build.

export function readBuildVersion(): string | null {
  if (typeof document === "undefined") return null;
  // Injected at build time by client/index.html (#manus-build-version).
  const marker = document.getElementById("manus-build-version")?.textContent;
  if (marker) {
    try {
      const parsed = JSON.parse(marker) as unknown;
      if (typeof parsed === "string") return parsed;
    } catch {
      // malformed marker — fall through to legacy global
    }
  }
  const legacy = (window as unknown as { __MANUS_BUILD_VERSION__?: string })
    .__MANUS_BUILD_VERSION__;
  return typeof legacy === "string" ? legacy : null;
}

export async function enforceFreshBundle(
  buildVersion: string,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): Promise<void> {
  try {
    const res = await fetchImpl("/__manus__/version.json", {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { version?: string };
    if (typeof data.version === "string" && data.version !== buildVersion) {
      window.location.reload();
    }
  } catch {
    // Network or parse failure — leave the current page untouched.
  }
}
