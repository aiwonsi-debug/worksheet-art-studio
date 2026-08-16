import fs from "node:fs";
import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Temporary diagnostic: inspects the production runtime layout to
  // determine why the version resolution chain falls through.
  diag: publicProcedure.query(() => {
    const entry = process.argv[1];
    return {
      nodeEnv: process.env.NODE_ENV,
      cwd: process.cwd(),
      argv: process.argv.slice(0, 3),
      entry: entry,
      entryExists: entry ? fs.existsSync(entry) : null,
      distExists: fs.existsSync("dist"),
      distPublicExists: fs.existsSync("dist/public"),
      distPublicIndexExists: fs.existsSync("dist/public/index.html"),
      versionJsonExists: fs.existsSync("client/public/__manus__/version.json"),
      distPublicAssetFiles: (() => {
        try {
          const html = fs.readFileSync("dist/public/index.html", "utf8");
          const js = html.match(/src="\/assets\/[^"]*\.js"/g) ?? [];
          const css = html.match(/href="\/assets\/[^"]*\.css"/g) ?? [];
          const marker = html.match(/manus-build-version[^>]*>([\da-f]+)/) ?? null;
          return { js: js.map((s) => s.slice(5, -1)), css: css.map((s) => s.slice(6, -1)), marker: marker ? marker[1] : null };
        } catch {
          return null;
        }
      })(),
      envKeys: Object.keys(process.env).filter((k) =>
        /MANUS|DEPLOY|VERSION|BUILD/i.test(k)
      ),
    };
  }),
});
