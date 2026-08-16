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

## Iteration history (Aug 16, ~14:30 UTC)
- Working sub-router: trpcRouter (express.Router()) in server/_core/index.ts; registerAppVersionRoute(trpcRouter) BEFORE tRPC middleware; route path must be RELATIVE ("/app-version") because app.use("/api/trpc", trpcRouter) composes paths. Client fetches GET /api/trpc/app-version. VERIFIED on dev server (returns {"version":"13db1dac"}).
- Tests: server/appVersion.test.ts tests path "/app-version" (relative, test app has no /api/trpc mount). 106 tests pass, pnpm check clean.
- Checkpoint 295544da published. BUT production GET /api/trpc/app-version returned {"version":null} — client/public/__manus__/version.json does NOT exist in production runtime (only dist/public shipped; edge rewrites block direct access).
- Production index.html marker STILL literal "__MANUS_BUILD_VERSION__" — vitePluginBuildVersionMarker does not run in prod build OR version.json absent at prod build time.
- Next approach (debug agent, high confidence): copy dist/public/__manus__/version.json into server/_core/public/__manus__/version.json during build (or generate server/_generated/buildVersion.ts from it), and read that at runtime (exists in prod image). Also patch dist/public/index.html marker in closeBundle using dist version.json so prod marker is injected.
- Platform facts: no MANUS_CHECKPOINT env var; Forge API can't query deployment SHA.

## Production pipeline understanding (Aug 16, ~14:45 UTC)
The platform runs `pnpm build` = `vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`. esbuild bundles everything non-external including local TS files, so importing a generated local module like server/_core/_buildVersion.ts will be inlined into dist/index.js. The esbuild --bundle resolves imports at build time; if we make vite build ALSO generate server/_core/_buildVersion.ts (from client/public/__manus__/version.json, via a vite plugin closeBundle or a small node script hooked into "build"), it ships into the server artifact. Runtime fallback: if the generated module is missing (e.g., version.json absent at build), handler returns null.
Chosen approach: (a) vite plugin (existing vitePluginBuildVersionMarker): after vite build (closeBundle), generate server/_core/_buildVersion.ts from dist/public/__manus__/version.json if present; if version.json absent (platform writes it after vite build?), fallback in plugin to git-independent constant — the platform DOES write client/public/__manus__/version.json (proven in dev). Need to verify what happens in platform production build order. Safer: at vite build time read client/public/__manus__/version.json directly (exists in repo in dev) and generate the module; also patch dist/public/index.html marker in closeBundle from the same source so prod index.html marker is injected even if platform re-serves dist index.html with placeholder.
(b) server/appVersion.ts: import BUILD_VERSION from "./_buildVersion" (ts-ignore-friendly module with default "unknown"), return it; remove fs read entirely (no file needed at runtime in production).
(c) Update tests: mock the import via vi.mock("./_buildVersion").
(d) cacheBust.ts: compare marker against fetched version from /api/trpc/app-version.

## State Aug 16 ~14:38 UTC (in progress)
Chosen approach: generate server/_core/buildVersion.ts at build time from client/public/__manus__/version.json via vitePluginBuildVersionMarker (buildStart hook + transformIndexHtml marker patch). appVersion.ts imports readBuildVersion() from ./_core/buildVersion. esbuild bundles it into dist/index.js.
Dev-server churn issue: tsx watch restarts whenever server/_core/buildVersion.ts changes (written by buildStart on every vite build, incl. periodic platform builds). Mitigation in progress: move generated module into server/_core/ — actually tsx watches server/_core/index.ts and all its deps, so it restarts anyway. Next: make the generated module write happen ONLY when content changes (writeFileSync with same content still changes mtime → still restarts). Better mitigation: gate generation behind NODE_ENV !== development (dev doesn't need build-time value; dev can read version.json at runtime or use placeholder "dev"). In dev, appVersion reads client/public/__manus__/version.json at runtime (exists in dev sandbox); in production it uses the baked module.
Remaining: (1) rewrite vitePluginBuildVersionMarker to generate server/_core/buildVersion.ts only in non-dev builds (or always but tolerate). (2) Update server/appVersion.ts to branch: dev reads file, prod uses baked constant. (3) Server test server/appVersionFallback.test.ts mocks "./_buildVersion" — update to mock "_core/buildVersion" or new module name. (4) pnpm test + check, checkpoint, verify prod curl /api/trpc/app-version returns JSON version, github push, deliver.
Also note: periodic platform builds rewrite client/public/__manus__/version.json (new version each checkpoint deploy), so buildStart reading it yields the latest checkpoint hash. The fallback test mocks the generated module path.
