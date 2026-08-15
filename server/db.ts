import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, worksheetAssets, worksheetProjects } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(worksheetProjects).where(eq(worksheetProjects.userId, userId)).orderBy(desc(worksheetProjects.updatedAt));
}

export async function getProject(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(worksheetProjects).where(and(eq(worksheetProjects.userId, userId), eq(worksheetProjects.id, projectId))).limit(1);
  return rows[0];
}

export async function createProject(userId: number, title: string, canvasData: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(worksheetProjects).values({ userId, title, canvasData });
  return getProject(userId, Number(result[0].insertId));
}

export async function updateProject(userId: number, projectId: number, input: { title?: string; canvasData?: string; thumbnailUrl?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await getProject(userId, projectId);
  if (!existing) return undefined;
  await db.update(worksheetProjects).set({ ...input, updatedAt: new Date() }).where(and(eq(worksheetProjects.userId, userId), eq(worksheetProjects.id, projectId)));
  return getProject(userId, projectId);
}

export async function deleteProject(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(worksheetProjects).where(and(eq(worksheetProjects.userId, userId), eq(worksheetProjects.id, projectId)));
}

export async function listAssets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(worksheetAssets).where(eq(worksheetAssets.userId, userId)).orderBy(desc(worksheetAssets.createdAt));
}

export async function createAsset(input: typeof worksheetAssets.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(worksheetAssets).values(input);
  const rows = await db.select().from(worksheetAssets).where(and(eq(worksheetAssets.userId, input.userId), eq(worksheetAssets.id, Number(result[0].insertId)))).limit(1);
  return rows[0];
}

export async function deleteAsset(userId: number, assetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(worksheetAssets).where(and(eq(worksheetAssets.userId, userId), eq(worksheetAssets.id, assetId)));
}
