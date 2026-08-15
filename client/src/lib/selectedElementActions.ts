import type { StudioLayer, WorksheetCanvasState } from "./studioTypes";

export function patchCanvasLayer(canvas: WorksheetCanvasState, id: string, patch: Partial<StudioLayer>): WorksheetCanvasState {
  return {
    ...canvas,
    layers: canvas.layers.map((layer) => layer.id === id ? ({ ...layer, ...patch } as StudioLayer) : layer),
  };
}

export function removeCanvasLayer(canvas: WorksheetCanvasState, id: string): WorksheetCanvasState {
  return { ...canvas, layers: canvas.layers.filter((layer) => layer.id !== id) };
}

export function duplicateCanvasLayer(canvas: WorksheetCanvasState, id: string, duplicateId: string): { canvas: WorksheetCanvasState; selectedId: string } | null {
  const layer = canvas.layers.find((candidate) => candidate.id === id);
  if (!layer) return null;
  const duplicate = { ...layer, id: duplicateId, name: `${layer.name} copy`, x: layer.x + 26, y: layer.y + 26 } as StudioLayer;
  return { canvas: { ...canvas, layers: [...canvas.layers, duplicate] }, selectedId: duplicateId };
}

export function reorderCanvasLayer(canvas: WorksheetCanvasState, id: string, direction: "forward" | "back"): WorksheetCanvasState {
  const index = canvas.layers.findIndex((layer) => layer.id === id);
  const target = direction === "forward" ? index + 1 : index - 1;
  if (index < 0 || target < 0 || target >= canvas.layers.length) return canvas;
  const layers = [...canvas.layers];
  [layers[index], layers[target]] = [layers[target], layers[index]];
  return { ...canvas, layers };
}
