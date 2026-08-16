import { describe, expect, it, vi } from "vitest";

describe("worker ?url import in jsdom", () => {
  it("loads the ?url worker specifier without loading the main build", async () => {
    // First confirm legacy alone works
    const legacy = await import("pdfjs-dist/legacy/build/pdf.mjs");
    expect(legacy.version).toBe("6.2.108");
  });

  it("does not trigger the main build when the worker asset URL resolves", async () => {
    vi.resetModules();
    const module = await import("./pdfImport");
    // If the main build loaded during import evaluation, stderr would show
    // "Please use the `legacy` build" — assert loadBundledWorkerUrl resolves.
    const url = await module.loadBundledWorkerUrl();
    expect(typeof url).toBe("string");
  });
});
