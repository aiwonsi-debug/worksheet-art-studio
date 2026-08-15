// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({ addImage: vi.fn(), save: vi.fn() }));
vi.mock("jspdf", () => ({ jsPDF: vi.fn(() => pdfMocks) }));

import { downloadWorksheet } from "./exportWorksheet";
import type { WorksheetCanvasState } from "./studioTypes";

const annotatedPdfPage: WorksheetCanvasState = {
  transparentBackground: false,
  layers: [
    { id: "pdf", type: "image", name: "PDF page", src: "data:image/png;base64,cGRm", x: 12, y: 0, width: 896, height: 1160, rotation: 0, opacity: 1, locked: true },
    { id: "annotation", type: "path", name: "Ink annotation", d: "M 0 0", color: "#4263eb", strokeWidth: 8, mode: "draw", x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1, points: [{ x: 10, y: 10, size: 8 }, { x: 40, y: 30, size: 12 }] },
  ],
};

describe("raster and PDF worksheet export", () => {
  const blobs: Blob[] = [];

  beforeEach(() => {
    blobs.length = 0;
    pdfMocks.addImage.mockReset();
    pdfMocks.save.mockReset();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["raster"], { type: "image/png" }) })));
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) { queueMicrotask(() => this.onload?.()); }
    } as unknown as typeof Image);
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => { blobs.push(blob); return `blob:paperloom-${blobs.length}`; },
      revokeObjectURL: () => undefined,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["raster"], { type: "image/png" })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rasterizes imported PDF pages underneath ink annotations for PNG export", async () => {
    await downloadWorksheet(annotatedPdfPage, "annotated lesson", "png");
    const svg = await blobs[0].text();
    expect(svg.indexOf("data:image/png;base64,cGRm")).toBeGreaterThan(-1);
    expect(svg.indexOf('fill="#4263eb"')).toBeGreaterThan(svg.indexOf("data:image/png;base64,cGRm"));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("embeds the rasterized annotated PDF page in PDF export", async () => {
    await downloadWorksheet(annotatedPdfPage, "annotated lesson", "pdf");
    const svg = await blobs[0].text();
    expect(svg.indexOf('fill="#4263eb"')).toBeGreaterThan(svg.indexOf("data:image/png;base64,cGRm"));
    expect(pdfMocks.addImage).toHaveBeenCalledWith(expect.stringContaining("data:image/"), "PNG", 0, 0, 612, 792, undefined, "FAST");
    expect(pdfMocks.save).toHaveBeenCalledWith("annotated-lesson.pdf");
  });
});
