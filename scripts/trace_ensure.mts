// Instrumented observation: replicate pdfImport's ensureWorker logic under
// the same mock conditions as the test to find why workerSrc is never set.
import { vi } from "vitest";

vi.doMock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/assets/pdf.worker.min.abc123.mjs" }), { virtual: true });
const captured: string[] = [];
vi.doMock(
  "pdfjs-dist",
  async () => ({
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: () => ({
      promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getViewport: () => ({}) }), destroy: () => {} }),
    }),
    version: "6.2.108",
    captured,
  }),
  { virtual: true }
);
vi.resetModules();

// Mirror of ensureWorker
async function ensureWorker() {
  try {
    const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    const workerUrl = new URL(workerModule.default, "https://artstudio-wfaanbnb.manus.space/").href;
    const pdfjs = (await import("pdfjs-dist")) as { GlobalWorkerOptions: { workerSrc: string } };
    console.log("[trace] workerUrl:", workerUrl);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    console.log("[trace] after assignment:", pdfjs.GlobalWorkerOptions.workerSrc);
  } catch (e) {
    console.log("[trace] CAUGHT:", (e as Error).message);
  }
}

await ensureWorker();
const mod = (await import("pdfjs-dist")) as typeof import("pdfjs-dist") & { captured?: string[] };
console.log("[trace] captured:", mod.captured);
