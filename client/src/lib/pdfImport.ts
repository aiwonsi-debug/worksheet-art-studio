import { WORKSHEET_HEIGHT, WORKSHEET_WIDTH, type ImageLayer, type WorksheetCanvasState } from "./studioTypes";

export type PdfPageInfo = { pageCount: number; name: string };
export type RenderedPdfPage = PdfPageInfo & { pageNumber: number; dataUrl: string; width: number; height: number };

const MAX_RENDER_DIMENSION = 1440;

export function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function pdfBaseName(fileName: string) {
  return fileName.replace(/\.pdf$/i, "").trim() || "Imported PDF";
}

export function fitPdfPageToWorksheet(pageWidth: number, pageHeight: number) {
  const safeWidth = Math.max(1, pageWidth);
  const safeHeight = Math.max(1, pageHeight);
  const scale = Math.min(WORKSHEET_WIDTH / safeWidth, WORKSHEET_HEIGHT / safeHeight);
  const width = Math.round(safeWidth * scale);
  const height = Math.round(safeHeight * scale);
  return { x: Math.round((WORKSHEET_WIDTH - width) / 2), y: Math.round((WORKSHEET_HEIGHT - height) / 2), width, height };
}

export function createPdfBackgroundLayer(input: { id: string; name: string; src: string; pageWidth: number; pageHeight: number }): ImageLayer {
  const bounds = fitPdfPageToWorksheet(input.pageWidth, input.pageHeight);
  return { id: input.id, type: "image", name: `${input.name} • PDF page`, src: input.src, ...bounds, rotation: 0, opacity: 1, locked: true };
}

export function insertPdfBackground(canvas: WorksheetCanvasState, input: { id: string; name: string; src: string; pageWidth: number; pageHeight: number }) {
  const layer = createPdfBackgroundLayer(input);
  return { canvas: { ...canvas, transparentBackground: false, layers: [layer, ...canvas.layers] }, layer };
}

async function loadPdf(file: File) {
  const [pdfjs, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
}

export async function inspectPdf(file: File): Promise<PdfPageInfo> {
  if (!isPdfFile(file)) throw new Error("Please choose a PDF file.");
  const pdfDocument = await loadPdf(file);
  try {
    return { pageCount: pdfDocument.numPages, name: pdfBaseName(file.name) };
  } finally {
    await (pdfDocument as { destroy?: () => Promise<void> }).destroy?.();
  }
}

export async function renderPdfPage(file: File, requestedPage: number): Promise<RenderedPdfPage> {
  if (!isPdfFile(file)) throw new Error("Please choose a PDF file.");
  const pdfDocument = await loadPdf(file);
  try {
    const pageNumber = Math.min(Math.max(1, Math.round(requestedPage)), pdfDocument.numPages);
    const page = await pdfDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, MAX_RENDER_DIMENSION / Math.max(baseViewport.width, baseViewport.height));
    const viewport = page.getViewport({ scale });
    const canvas = globalThis.document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Your browser cannot render a PDF page.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return { pageCount: pdfDocument.numPages, name: pdfBaseName(file.name), pageNumber, dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  } finally {
    await (pdfDocument as { destroy?: () => Promise<void> }).destroy?.();
  }
}
