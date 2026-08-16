import { WORKSHEET_HEIGHT, WORKSHEET_WIDTH, type ImageLayer, type WorksheetCanvasState } from "./studioTypes";

export type PdfPageInfo = { pageCount: number; name: string };
export type RenderedPdfPage = PdfPageInfo & { pageNumber: number; dataUrl: string; width: number; height: number };

const MAX_RENDER_DIMENSION = 1440;

/**
 * Build the version-matched pdf.js CDN worker URL used when the bundled
 * worker module cannot be loaded (e.g. Brave Android with strict shields).
 * Exported as a pure function so its shape is regression-testable without a
 * worker runtime.
 */
export function fallbackWorkerUrl(pdfJsVersion: string): string {
  return new URL(`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfJsVersion}/pdf.worker.min.mjs`, globalThis.document.baseURI).href;
}

/**
 * Resolve a worker module URL against the document origin so module workers
 * never load from a malformed relative path.
 */
export function resolveWorkerUrl(moduleUrl: string): string {
  return new URL(moduleUrl, globalThis.document.baseURI).href;
}

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

type PdfjsNamespace = typeof import("pdfjs-dist");

let cachedPdfjs: PdfjsNamespace | null = null;
let workerSetupFailed = false;
let workerConfigured = false;

/**
 * Loader for the pdf.js module namespace. Exported so tests can substitute the
 * worker-free legacy build, keeping the worker configuration and fallback
 * logic verifiable against the real library without mocking package specifiers.
 */
export async function resolvePdfjsBundle(): Promise<PdfjsNamespace> {
  return import("pdfjs-dist");
}

async function loadPdfjs(): Promise<PdfjsNamespace> {
  if (!cachedPdfjs) {
    cachedPdfjs = await resolvePdfjsBundle();
  }
  return cachedPdfjs;
}

async function loadFallbackPdfjs(): Promise<PdfjsNamespace> {
  // When the bundled worker module cannot be loaded (e.g. Brave Android with
  // strict shields blocking the hashed asset), fall back to the matching
  // worker from the pdf.js CDN. pdfjs wraps cross-origin URLs in a Blob
  // wrapper automatically, which loads reliably on mobile.
  const pdfjs = await loadPdfjs();
  const workerUrl = fallbackWorkerUrl(pdfjs.version);
  setWorkerSrc(workerUrl);
  cachedPdfjs = pdfjs;
  return pdfjs;
}

/**
 * Load the bundled pdf.js worker URL. Kept as a named export so tests can
 * replace it (Vite's `?url` specifier is not mockable directly in Vitest).
 */
export async function loadBundledWorkerUrl(): Promise<string> {
  const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  return workerModule.default as string;
}

async function ensureWorker(): Promise<void> {
  if (workerConfigured || workerSetupFailed) return; // Configured once, or fell back to CDN.
  try {
    // Resolve relative asset URLs against the document origin so module workers
    // never load from a malformed path (a known failure on some mobile browsers
    // such as Brave Android with strict shields).
    const workerUrl = resolveWorkerUrl(await loadBundledWorkerUrl());
    setWorkerSrc(workerUrl);
    workerConfigured = true;
  } catch {
    workerSetupFailed = true;
  }
}

/**
 * Apply the worker source to the loaded pdf.js library.
 * Exported as a named function so tests can spy on the configured URL without
 * touching pdf.js internals (module namespaces freeze property assignment).
 */
export function setWorkerSrc(workerUrl: string): void {
  // Lazily loading here keeps the cached library shared with rendering.
  void (async () => {
    const pdfjs = await loadPdfjs();
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  })();
}

async function loadPdf(file: File) {
  await ensureWorker();
  const pdfjs = workerSetupFailed ? await loadFallbackPdfjs() : await loadPdfjs();
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
