import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";
import { ASSET_KINDS, buildWorksheetAssetPrompt, decodeImageDataUrl, normalizeWorksheetTitle } from "./worksheetUtils";

const canvasInput = z.string().min(2).max(250_000);
const projectIdInput = z.object({ projectId: z.number().int().positive() });
const assetKindInput = z.enum(ASSET_KINDS);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  project: router({
    list: protectedProcedure.query(({ ctx }) => db.listProjects(ctx.user.id)),
    get: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
      const project = await db.getProject(ctx.user.id, input.projectId);
      if (!project) throw new Error("Worksheet not found.");
      return project;
    }),
    create: protectedProcedure.input(z.object({ title: z.string().max(160), canvasData: canvasInput })).mutation(async ({ ctx, input }) => {
      const project = await db.createProject(ctx.user.id, normalizeWorksheetTitle(input.title), input.canvasData);
      if (!project) throw new Error("Worksheet could not be created.");
      return project;
    }),
    update: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), title: z.string().max(160).optional(), canvasData: canvasInput.optional() })).mutation(async ({ ctx, input }) => {
      const project = await db.updateProject(ctx.user.id, input.projectId, {
        title: input.title === undefined ? undefined : normalizeWorksheetTitle(input.title),
        canvasData: input.canvasData,
      });
      if (!project) throw new Error("Worksheet not found.");
      return project;
    }),
    remove: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
      await db.deleteProject(ctx.user.id, input.projectId);
      return { success: true } as const;
    }),
  }),
  asset: router({
    list: protectedProcedure.query(({ ctx }) => db.listAssets(ctx.user.id)),
    save: protectedProcedure.input(z.object({ kind: assetKindInput, name: z.string().min(1).max(160), dataUrl: z.string().min(16).max(17_000_000), prompt: z.string().max(1200).optional() })).mutation(async ({ ctx, input }) => {
      const { bytes, mimeType } = decodeImageDataUrl(input.dataUrl);
      const extension = mimeType.includes("svg") ? "svg" : mimeType.includes("jpeg") ? "jpg" : "png";
      const { key, url } = await storagePut(`users/${ctx.user.id}/assets/${Date.now()}.${extension}`, bytes, mimeType);
      const asset = await db.createAsset({ userId: ctx.user.id, kind: input.kind, name: input.name.trim(), prompt: input.prompt ?? null, storageKey: key, url, mimeType });
      if (!asset) throw new Error("Asset could not be saved.");
      return asset;
    }),
    generate: protectedProcedure.input(z.object({ kind: z.enum(["clipart", "border", "header"]), name: z.string().min(1).max(160), prompt: z.string().min(3).max(1200), style: z.string().max(320).optional() })).mutation(async ({ ctx, input }) => {
      const prompt = buildWorksheetAssetPrompt(input);
      const result = await generateImage({ prompt, quality: "medium" });
      if (!result.url) throw new Error("The image service returned no artwork.");
      const asset = await db.createAsset({ userId: ctx.user.id, kind: input.kind, name: input.name.trim(), prompt: input.prompt, storageKey: result.url.replace("/manus-storage/", ""), url: result.url, mimeType: "image/png" });
      if (!asset) throw new Error("Generated artwork could not be saved.");
      return asset;
    }),
    remove: protectedProcedure.input(z.object({ assetId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await db.deleteAsset(ctx.user.id, input.assetId);
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
