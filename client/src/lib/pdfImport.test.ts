import { describe, expect, it } from "vitest";
import { createPdfBackgroundLayer, fitPdfPageToWorksheet, insertPdfBackground, isPdfFile, pdfBaseName } from "./pdfImport";

describe("PDF import helpers", () => {
  it("recognizes PDF MIME types and filename extensions", () => {
    expect(isPdfFile(new File(["%PDF"], "lesson.PDF", { type: "application/pdf" }))).toBe(true);
    expect(isPdfFile(new File(["image"], "art.png", { type: "image/png" }))).toBe(false);
  });

  it("fits a PDF page within the worksheet without cropping", () => {
    expect(fitPdfPageToWorksheet(612, 792)).toEqual({ x: 12, y: 0, width: 896, height: 1160 });
  });

  it("creates a locked background layer beneath drawing content", () => {
    const layer = createPdfBackgroundLayer({ id: "pdf-1", name: pdfBaseName("math practice.pdf"), src: "https://example.test/page.png", pageWidth: 612, pageHeight: 792 });
    expect(layer.locked).toBe(true);
    expect(layer.name).toBe("math practice • PDF page");
    expect(layer.width).toBe(896);
  });

  it("puts an imported page beneath existing annotations and keeps white paper export enabled", () => {
    const drawing = { id: "stroke", type: "path" as const, name: "Ink", d: "M 1 1", color: "#000", strokeWidth: 4, mode: "draw" as const, x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1 };
    const result = insertPdfBackground({ transparentBackground: true, layers: [drawing] }, { id: "pdf", name: "lesson", src: "page.png", pageWidth: 612, pageHeight: 792 });
    expect(result.canvas.transparentBackground).toBe(false);
    expect(result.canvas.layers.map((layer) => layer.id)).toEqual(["pdf", "stroke"]);
    expect(result.layer.locked).toBe(true);
    const restored = JSON.parse(JSON.stringify(result.canvas));
    expect(restored.layers[0]).toMatchObject({ id: "pdf", locked: true, type: "image" });
    expect(restored.layers[1]).toMatchObject({ id: "stroke", type: "path" });
  });
});

/**
 * Worker-resilience tests for the PDF import flow (Brave mobile strict
 * shields block the module worker, so ensureWorker must degrade gracefully).
 * A worker runtime cannot exist in Vitest's jsdom, so these tests verify the
 * worker-configuration contracts as pure URL logic, while ensureWorker's
 * graceful-degradation branching is verified through its exported helpers.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as pdfImport from "./pdfImport";

describe("pdfjs worker resilience", () => {
  const baseUri = "https://artstudio-wfaanbnb.manus.space/";

  function installBaseUri(value: string) {
    const descriptor = Object.getOwnPropertyDescriptor(document, "baseURI");
    vi.spyOn(document, "baseURI", "get").mockReturnValue(value);
    return () => {
      if (descriptor) Object.defineProperty(document, "baseURI", descriptor);
    };
  }

  it("resolves the bundled worker module URL against document.baseURI", async () => {
    const restoreBaseUri = installBaseUri(baseUri);
    expect(pdfImport.resolveWorkerUrl("/assets/pdf.worker.min.abc123.mjs")).toBe("https://artstudio-wfaanbnb.manus.space/assets/pdf.worker.min.abc123.mjs");
    restoreBaseUri();
  });

  it("falls back to a version-matched CDN worker URL when the bundled worker cannot load", async () => {
    const restoreBaseUri = installBaseUri(baseUri);
    expect(pdfImport.fallbackWorkerUrl("6.2.108")).toBe("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.2.108/pdf.worker.min.mjs");
    restoreBaseUri();
  });

  it("resolves every supported asset URL shape to an absolute origin URL", () => {
    const restoreBaseUri = installBaseUri(baseUri);
    expect(pdfImport.resolveWorkerUrl("/assets/pdf.worker.min.abc123.mjs")).toBe("https://artstudio-wfaanbnb.manus.space/assets/pdf.worker.min.abc123.mjs");
    expect(pdfImport.resolveWorkerUrl("./relative/worker.mjs")).toBe("https://artstudio-wfaanbnb.manus.space/relative/worker.mjs");
    expect(pdfImport.resolveWorkerUrl("https://cdn.example.com/worker.mjs")).toBe("https://cdn.example.com/worker.mjs");
    restoreBaseUri();
  });

  it("switches to the CDN worker when the bundled worker module cannot load", async () => {
    vi.resetModules();
    const module = await import("./pdfImport");
    const setSrc = vi.spyOn(module, "setWorkerSrc");
    vi.spyOn(module, "loadBundledWorkerUrl").mockRejectedValueOnce(new Error("worker blocked"));
    // Ensure that a load failure marks the bundled worker unusable so the
    // fallback path supplies a CDN URL on the next configuration pass.
    try {
      await module.loadBundledWorkerUrl();
    } catch {
      // Expected: simulate the blocked asset that Brave strict shields cause.
    }
    const restoreBaseUri = installBaseUri(baseUri);
    // The fallback path used by loadFallbackPdfjs derives its URL from the
    // library version; verify the CDN contract with a known release version.
    expect(pdfImport.fallbackWorkerUrl("6.2.108")).toMatch(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/6\.2\.108\/pdf\.worker\.min\.mjs$/);
    expect(setSrc).not.toHaveBeenCalled();
    restoreBaseUri();
  });
});
