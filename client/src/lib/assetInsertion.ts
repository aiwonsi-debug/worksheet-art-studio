import type { StudioLayer, WorksheetCanvasState } from "./studioTypes";

export type InsertableAsset = { id: number; name: string; url: string; kind: string };

export function insertAssetOnCanvas(canvas: WorksheetCanvasState, asset: InsertableAsset, id: string) {
  const isBorder = asset.kind === "border";
  const isHeader = asset.kind === "header";
  const width = isBorder ? 830 : isHeader ? 650 : 250;
  const height = isBorder ? 1040 : isHeader ? 210 : 250;
  const layer: StudioLayer = { id, type: "image", name: asset.name, src: asset.url, x: (920 - width) / 2, y: isHeader ? 66 : (1160 - height) / 2, width, height, rotation: 0, opacity: 1 };
  return { canvas: { ...canvas, layers: [...canvas.layers, layer] }, selectedId: id, layer };
}
