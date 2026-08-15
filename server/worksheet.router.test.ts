import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listAssets: vi.fn(),
  getProject: vi.fn(),
  deleteProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  createAsset: vi.fn(),
  deleteAsset: vi.fn(),
  storagePut: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock("./db", () => ({
  ...dbMocks,
}));

vi.mock("./storage", () => ({ storagePut: dbMocks.storagePut }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: dbMocks.generateImage }));

import { appRouter } from "./routers";

function createContext(userId = 27): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      name: "Worksheet user",
      email: "worksheet@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("worksheet router user isolation contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists worksheets and assets only for the authenticated user", async () => {
    dbMocks.listProjects.mockResolvedValue([]);
    dbMocks.listAssets.mockResolvedValue([]);
    const caller = appRouter.createCaller(createContext(27));

    await caller.project.list();
    await caller.asset.list();

    expect(dbMocks.listProjects).toHaveBeenCalledWith(27);
    expect(dbMocks.listAssets).toHaveBeenCalledWith(27);
  });

  it("scopes a requested worksheet lookup and deletion to the signed-in user", async () => {
    dbMocks.getProject.mockResolvedValue(undefined);
    dbMocks.deleteProject.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext(42));

    await expect(caller.project.get({ projectId: 8 })).rejects.toThrow("Worksheet not found");
    await caller.project.remove({ projectId: 8 });

    expect(dbMocks.getProject).toHaveBeenCalledWith(42, 8);
    expect(dbMocks.deleteProject).toHaveBeenCalledWith(42, 8);
  });

  it("creates and updates worksheets with the authenticated user identifier", async () => {
    dbMocks.createProject.mockResolvedValue({ id: 3 });
    dbMocks.updateProject.mockResolvedValue({ id: 3 });
    const caller = appRouter.createCaller(createContext(9));

    await caller.project.create({ title: "  My worksheet  ", canvasData: "{}" });
    await caller.project.update({ projectId: 3, title: "  Renamed worksheet ", canvasData: "{}" });

    expect(dbMocks.createProject).toHaveBeenCalledWith(9, "My worksheet", "{}");
    expect(dbMocks.updateProject).toHaveBeenCalledWith(9, 3, { title: "Renamed worksheet", canvasData: "{}" });
  });

  it("persists uploaded and generated assets under the authenticated user before allowing deletion", async () => {
    dbMocks.storagePut.mockResolvedValue({ key: "users/12/assets/file.png", url: "/manus-storage/file.png" });
    dbMocks.generateImage.mockResolvedValue({ url: "/manus-storage/generated.png" });
    dbMocks.createAsset.mockResolvedValue({ id: 6 });
    dbMocks.deleteAsset.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext(12));

    await caller.asset.save({ kind: "upload", name: "Uploaded star", dataUrl: "data:image/png;base64,aGVsbG8=" });
    await caller.asset.generate({ kind: "clipart", name: "Generated fox", prompt: "a friendly fox holding a pencil" });
    await caller.asset.remove({ assetId: 6 });

    expect(dbMocks.createAsset).toHaveBeenNthCalledWith(1, expect.objectContaining({ userId: 12, kind: "upload", name: "Uploaded star" }));
    expect(dbMocks.createAsset).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId: 12, kind: "clipart", name: "Generated fox", url: "/manus-storage/generated.png" }));
    expect(dbMocks.deleteAsset).toHaveBeenCalledWith(12, 6);
  });

  it("accepts long custom clipart descriptions and persists a valid shortened asset name", async () => {
    dbMocks.generateImage.mockResolvedValue({ url: "/manus-storage/generated.png" });
    dbMocks.createAsset.mockResolvedValue({ id: 7 });
    const caller = appRouter.createCaller(createContext(12));
    const longDescription = "cute black-and-white doodle of a smiling cat sitting with its tail curled around its paws, simple bold ink outlines, minimal child-friendly worksheet clipart, no shading, no text, transparent background ".repeat(2);

    await expect(caller.asset.generate({ kind: "clipart", name: longDescription, prompt: longDescription })).resolves.toEqual({ id: 7 });

    expect(dbMocks.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      userId: 12,
      kind: "clipart",
      name: expect.stringMatching(/^cute black-and-white doodle/),
    }));
    expect((dbMocks.createAsset.mock.calls[0]?.[0] as { name: string }).name).toHaveLength(160);
  });
});
