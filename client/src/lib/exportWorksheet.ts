import { jsPDF } from "jspdf";
import type { StudioLayer, WorksheetCanvasState } from "./studioTypes";
import { WORKSHEET_HEIGHT, WORKSHEET_WIDTH } from "./studioTypes";
import { shapePoints } from "./drawingElements";

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function renderLayer(layer: StudioLayer, imageSources: Map<string, string>) {
  const transform = `rotate(${layer.rotation} ${layer.x + layer.width / 2} ${layer.y + layer.height / 2})`;
  if (layer.type === "image") {
    return `<image href="${escape(imageSources.get(layer.src) ?? layer.src)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" opacity="${layer.opacity}" preserveAspectRatio="none" transform="${transform}" />`;
  }
  if (layer.type === "text") return `<text x="${layer.x}" y="${layer.y + layer.fontSize}" fill="${layer.color}" font-size="${layer.fontSize}" font-weight="${layer.fontWeight}" font-family="DM Sans, sans-serif" opacity="${layer.opacity}" transform="${transform}">${escape(layer.text)}</text>`;
  if (layer.type === "shape") {
    const fill = `fill="${layer.fill}" fill-opacity="${layer.fillOpacity}"`;
    const stroke = `stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${layer.opacity}"`;
    if (layer.shape === "rectangle") return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="12" ${fill} ${stroke} transform="${transform}"/>`;
    if (layer.shape === "ellipse") return `<ellipse cx="${layer.x + layer.width / 2}" cy="${layer.y + layer.height / 2}" rx="${Math.abs(layer.width / 2)}" ry="${Math.abs(layer.height / 2)}" ${fill} ${stroke} transform="${transform}"/>`;
    const points = shapePoints(layer.shape, layer.x, layer.y, layer.width, layer.height);
    if (points) return `<polygon points="${points}" ${fill} ${stroke} transform="${transform}"/>`;
    const marker = layer.shape === "arrow" ? ` marker-end="url(#paperloom-arrow)"` : "";
    return `<line x1="${layer.x}" y1="${layer.y}" x2="${layer.x + layer.width}" y2="${layer.y + layer.height}" ${stroke} stroke-linecap="round" transform="${transform}"${marker}/>`;
  }
  const style = `mix-blend-mode:${layer.mode === "erase" ? "destination-out" : "normal"}`;
  if (layer.points?.length === 1) { const point = layer.points[0]; return `<circle cx="${point.x}" cy="${point.y}" r="${point.size / 2}" fill="${layer.mode === "erase" ? "#000" : layer.color}" opacity="${layer.opacity}" style="${style}" />`; }
  if (layer.points && layer.points.length > 1) return `<g opacity="${layer.opacity}" style="${style}">${layer.points.slice(1).map((point, index) => { const previous = layer.points![index]; return `<path d="M ${previous.x} ${previous.y} L ${point.x} ${point.y}" fill="none" stroke="${layer.mode === "erase" ? "#000" : layer.color}" stroke-width="${point.size}" stroke-linecap="round" stroke-linejoin="round" />`; }).join("")}</g>`;
  return `<path d="${escape(layer.d)}" fill="none" stroke="${layer.mode === "erase" ? "#000" : layer.color}" stroke-width="${layer.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${layer.opacity}" style="${style}" />`;
}

export function renderWorksheetSvg(state: WorksheetCanvasState, imageSources = new Map<string, string>()) {
  const background = state.transparentBackground ? "" : `<rect width="${WORKSHEET_WIDTH}" height="${WORKSHEET_HEIGHT}" fill="#ffffff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WORKSHEET_WIDTH}" height="${WORKSHEET_HEIGHT}" viewBox="0 0 ${WORKSHEET_WIDTH} ${WORKSHEET_HEIGHT}"><defs><marker id="paperloom-arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 z" fill="#42634f"/></marker></defs><g style="isolation:isolate">${background}${state.layers.map((layer) => renderLayer(layer, imageSources)).join("")}</g></svg>`;
}

async function sourceToDataUrl(src: string) {
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error("An asset could not be prepared for export.");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("An asset could not be read for export."));
    reader.readAsDataURL(blob);
  });
}

async function embeddedSources(state: WorksheetCanvasState) {
  const sources = state.layers.filter((layer): layer is Extract<StudioLayer, { type: "image" }> => layer.type === "image").map((layer) => layer.src);
  const entries = await Promise.all(Array.from(new Set(sources)).map(async (src) => [src, await sourceToDataUrl(src)] as const));
  return new Map(entries);
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

async function worksheetPng(state: WorksheetCanvasState) {
  const sourceMap = await embeddedSources(state);
  const svg = renderWorksheetSvg(state, sourceMap);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Worksheet could not be rasterized."));
      img.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = WORKSHEET_WIDTH * 2;
    canvas.height = WORKSHEET_HEIGHT * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser does not support image export.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Worksheet could not be rasterized.")), "image/png"));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export async function downloadWorksheet(state: WorksheetCanvasState, title: string, format: "png" | "svg" | "pdf") {
  const filename = `${title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "worksheet"}`;
  if (format === "svg") {
    const sourceMap = await embeddedSources(state);
    saveBlob(new Blob([renderWorksheetSvg(state, sourceMap)], { type: "image/svg+xml;charset=utf-8" }), `${filename}.svg`);
    return;
  }
  const png = await worksheetPng(state);
  if (format === "png") {
    saveBlob(png, `${filename}.png`);
    return;
  }
  const pngDataUrl = await sourceToDataUrl(URL.createObjectURL(png));
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [612, 792] });
  pdf.addImage(pngDataUrl, "PNG", 0, 0, 612, 792, undefined, "FAST");
  pdf.save(`${filename}.pdf`);
}
