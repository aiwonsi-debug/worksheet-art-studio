# Notes: dark paper dock toggle + dark artboard clarification (Aug 16)

## User intent clarification
- User: "iwant canvas dark but paper white" — dark artboard around the sheet (already ships in build: .art-canvas-zone #1c2120, .art-workspace #222927), white paper (default).
- Their Brave mobile showed white around sheet => stale cached bundle. Cache-busting mechanism added in checkpoint e3bf7353 (vitePluginBuildVersionMarker + client/src/lib/cacheBust.ts).
- User's earlier screenshot (205322) actually showed the NEW footer dock with pencil/marker/highlighter — so latest build IS partially reaching them, but artboard appeared dark in that screenshot too (dark gray around dock). White area in the screenshot was the SHEET itself (correct: white paper).

## Changes made this session (not yet checkpointed)
1. client/src/pages/Home.tsx: added labeled dark paper toggle button in footer dock (art-dock-actions, left of AI artwork):
   `<button className={`art-dock-paper-toggle ${canvas.darkPaper ? "is-on" : ""}`} onClick={() => setCanvas((c) => ({...c, darkPaper: !c.darkPaper}))} ...>` uses Moon icon, label "Dark paper"/"Light paper".
2. client/src/styles/artStudio.css: appended .art-dock-paper-toggle styles (height 32px, .is-on dark green bg #2f4438).
3. client/src/lib/darkPaperToggle.test.tsx: new test file with DockPaperToggleHarness (useState harness), assertions via getAttribute/classList (no jest-dom in project). Requires jsdom.
4. vitest.config.ts: added ["client/src/lib/darkPaperToggle.test.tsx", "jsdom"] to environmentMatchGlobs.
5. client/src/lib/darkPaper.test.ts: restored to original 3+3 state tests (removed duplicate harness code via sed earlier).

## Verification remaining
- `pnpm test` + `pnpm check` (currently: darkPaper.test.ts may still fail if sed edit broke it — re-check content)
- Screenshot desktop + 390px
- Production verify: curl prod CSS for art-dock-paper-toggle + version.json
- Checkpoint + GitHub sync (private repo: aiwonsi-debug/worksheet-art-studio)

## Prior context
- Checkpoint e3bf7353: cache-busting. f2bb8de1: dark paper feature (Moon toggle in rail bottom + export handling, dark fill #1e2422).
- Production domain: artstudio-wfaanbnb.manus.space

## Production routing facts (verified by curl, Aug 16 ~14:15 UTC)
- /api/trpc/* -> Express (404 JSON handled). /api/oauth/callback -> Express (400 JSON handled).
- EVERYTHING else (/api/app-version, /__manus__/version.json, /robots.txt, any unknown path) -> SPA index.html rewrite (200 text/html). Edge does NOT serve client/public static files in production; only /assets/* and / work for static.
- Therefore cache-busting version endpoint MUST live under /api/trpc/* path space.

## Current implementation (3rd attempt)
- server/appVersion.ts: app.get("/api/trpc/app-version", ...) reads client/public/__manus__/version.json, returns {"version":"054e0f6f"|null} as JSON; errors -> 200 null version.
- server/_core/index.ts: registerAppVersionRoute(app) added before tRPC middleware.
- client/src/lib/cacheBust.ts: enforceFreshBundle fetches `/api/trpc/app-version?v=${Date.now()}` (no-store).
- server/appVersion.test.ts: 4 tests against /api/trpc/app-version (version "054e0f6f", content-type, missing-file -> null, query param tolerance). Hardcodes "054e0f6f" from version.json.
- client/src/lib/cacheBust.test.ts: updated doc comment (mocked fetch).

## Version source-of-truth note
- client/public/__manus__/version.json is written by the deploy framework, NOT the git checkpoint hash. Currently version "054e0f6f". Build plugin replaces "__MANUS_BUILD_VERSION__" in index.html at build time.
- Production index.html still shows literal "__MANUS_BUILD_VERSION__" in served HTML — verify after next deploy whether the served HTML contains the injected marker. Both marker and endpoint read the SAME version.json, so consistency holds either way.
- Local check: dist/public/index.html contains "054e0f6f" marker.

## Remaining steps
1. pnpm test (all) + pnpm check — then checkpoint.
2. Verify production: curl /api/trpc/app-version -> {"version":...} after deploy rollout (~45-60s).
3. Sync to GitHub (git push github main).
4. Mark todo items done; deliver with instruction to refresh Brave mobile.
