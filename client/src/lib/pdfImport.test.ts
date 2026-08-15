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
  });
});
