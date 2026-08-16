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

## State Aug 16 ~14:47 UTC — FINAL approach working
FINAL approach (NO source mutation during builds):
- scripts/build.mjs: runs `npx vite build` then esbuild API build with define: {DEPLOYED_VERSION: JSON.stringify(version from client/public/__manus__/version.json)}.
- package.json build script now: "node scripts/build.mjs" (was "vite build && esbuild ...").
- server/_core/buildVersion.ts: `declare const DEPLOYED_VERSION: string | undefined; const BAKED = typeof DEPLOYED_VERSION === "string" ? DEPLOYED_VERSION : null;` readBuildVersion() returns BAKED or runtime file read in dev, or "unknown".
- vite.config.ts plugin now ONLY patches index.html marker (#manus-build-version); removed server file mutation.
- client/src/lib/cacheBust.ts: reads marker (ignores "__MANUS_BUILD_VERSION__" placeholder), enforceFreshBundle(null|string) fetches /api/trpc/app-version, reloads when server version differs or build marker unknown; sessionStorage guard key "paperloom-reloaded-version" prevents reload loops.
- Tests: 110 pass (27 files), clean typecheck. appVersionFallback.test.ts mocks readBuildVersion.
- Verified sandbox build: dist/index.js contains the injected version (0c091528).
- App renders fine (screenshot OK). Dev server restart churn STOPPED (no source mutation).
- Production endpoint verified earlier: {"version":"27fbd4c9"} live on artstudio-wfaanbnb.manus.space/api/trpc/app-version.
Remaining: checkpoint (publishes), verify prod endpoint shows NEW version, push github, deliver to user.

## State Aug 16 ~15:15 UTC
Definitive finding: platform production pipeline uses its own build commands; does NOT run scripts/build.mjs, does NOT run our Vite plugins (index.html marker stays placeholder "__MANUS_BUILD_VERSION__"), server container lacks client/public and dist/public. ONLY guaranteed runtime sources: platform env vars (none known to carry checkpoint) or self-derived server bundle hash.
Chosen final strategy: server/_core/buildVersion.ts getBuildVersion() = prefer DEPLOYED_VERSION define, else BUNDLE_HASH = sha256 of server entry script file (process.argv[1] path relative; use readFileSync on dist/index.js or import.meta.resolve? Simpler: hash of dist/index.js itself via fs.readFileSync at path serverEntry). Actually simplest stable self-derived token: compute sha256 of a fixed list of server source files? No — must be stable across restarts; dist/index.js is stable between deploys. Use crypto.createHash('sha256') of dist/index.js contents (platform likely doesn't ship dist public dir... but dist/index.js IS the server entry being executed! It's dist/index.js in platform too presumably). Actually server container runs node dist/index.js — the file exists (it's argv[1]). Hash its own file (self-read) = stable deploy token, changes when server code deploys.
Client-side: enforceFreshBundle already treats unknown build marker → reload for any non-unknown server version, with sessionStorage loop guard. The token is opaque, any string works.
Tests to update: server/appVersion.test.ts (asserts version === published version.json value) → change to asserting truthy non-"unknown" (via mocking fs.readFileSync of serverEntry).
Then checkpoint + wait rollout + verify prod returns non-unknown hash + push github + deliver.

## State Aug 16 ~15:00 UTC — checkpoint 84d8b866 saved (auto-published)
Final version resolution chain in server/_core/buildVersion.ts (per-request, no module cache):
1. DEPLOYED_VERSION define (local build script only — platform ignores it)
2. client/public/__manus__/version.json (dev only, also source for prod test expectations)
3. dist/public/index.html #manus-build-version marker (when our local build refreshes it; platform HTML stays placeholder — never useful in prod)
4. SHA-256 of process.argv[1] slice(0,8) (self-derived deploy token — GUARANTEED in prod, changes per server-code deploy)
5. "unknown" sentinel (client never reloads for it)

Resolution order: version.json BEFORE spa marker (sandbox dist stale; platform rewrites version.json frequently).
appVersion.ts: registerAppVersionRoute on sub-router "/app-version" BEFORE tRPC middleware (sub-router mounted at /api/trpc in server/_core/index.ts).
cacheBust.ts (client): readBuildVersion ignores placeholder "__MANUS_BUILD_VERSION__"; enforceFreshBundle(null|string) reloads when server version != build version or build unknown, sessionStorage guard key "paperloom-reloaded-version".
Tests: 110 pass (snapshot version.json once per run; appVersionFallback.test.ts mocks readBuildVersion returning "unknown").
Remaining: (1) verify prod /api/trpc/app-version returns NON-unknown after 84d8b866 rollout (wait ~90s, check). Expect a self-derived hash like sha-xxxx since platform skips define and lacks files. (2) Push to GitHub: cd /home/ubuntu/worksheet-art-studio && git add -A && git commit -m "..." && git push github main (remote name likely "github"; check `git remote -v`). (3) Deliver final message: tell user to refresh Brave on phone, dark artboard + white paper default, dock Light/Dark paper toggle, draw under toolbar works, cache busting automatic.
GitHub remote check: earlier push used some remote; verify with git remote -v.

## State Aug 16 ~15:35 UTC — checkpoint 864c4a9f (decisive probe)
DECISIVE FINDINGS:
- Production index.html NOW contains buildprobe-779121fd comment (Vite build DOES run on platform!) and serves old-named asset index-Dgo74T5i.js.
- BUT /tmp/probundle1.js (prod bundle, 958KB) DOES contain the NEWEST cache-bust code (app-version URL + paperloom-reloaded-version guard + unknown-tolerant logic = latest cacheBust.ts). Yet local sandbox build of SAME HEAD produces index-HXCxQG3V.js (1.24MB, different content).
- So: platform serves its own asset naming/content that is OUT OF SYNC with sandbox. The prod bundle content ≈ newer than 32fc73d9 but hash name frozen. Likely the platform CDN serves files hashed differently (different minifier) and index-Dgo74T5i.js has been UPDATED in place on the CDN (hash not content-identity anymore!). This means prod IS up-to-date or close; earlier "unknown"/missing-version diagnosis was about a transitional state.
- The server-side version resolution works: /api/trpc/app-version returns aced6a2e (from dist/public/index.html marker on server, injected by platform build). The marker regex requires manus-build-version class script content "[hash]" — prod HTML on server has marker injected (aced6a2e).
- Client-side cacheBust.ts: tolerates placeholder, reloads on server version change, sessionStorage guard paperloom-reloaded-version. The prod JS bundle already contains this code.
- Next steps to close the loop:
  1. Remove temporary system.diag probe from server/_core/systemRouter.ts (keep clean code). Keep app-version endpoint + buildVersion chain (it now works: aced6a2e).
  2. The cache bust should now self-heal: browser loads prod bundle (has tolerant cacheBust) → fetches /api/trpc/app-version (aced6a2e) → compares marker (placeholder on served HTML? — the served HTML is platform build; marker may or may not be injected in served HTML). If build unknown, reloads once per server version.
  3. Run pnpm test + pnpm check, fix tests, then checkpoint.
  4. Push to GitHub: git add -A && git commit -m "..." && git push <remote> main (check git remote -v for the private repo remote).
  5. Deliver final result to user: all features live; ask to refresh Brave.
- Test flakiness note: version.json rewritten by platform rclone every ~35s in sandbox; server tests snapshot it once; appVersionFallback.test.ts mocks readBuildVersion.
