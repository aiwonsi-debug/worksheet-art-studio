import type { ShapeLayer, StudioLayer, WorksheetCanvasState } from "./studioTypes";

export function isClosedShape(shape: ShapeLayer["shape"]) {
  return shape !== "line" && shape !== "arrow";
}

export function fillSelectedShape(state: WorksheetCanvasState, layerId: string, color: string) {
  const layer = state.layers.find((item) => item.id === layerId);
  if (!layer || layer.type !== "shape" || !isClosedShape(layer.shape)) return state;
  return {
    ...state,
    layers: state.layers.map((item) => {
      if (item.id !== layerId || item.type !== "shape") return item;
      return { ...item, fill: color, fillOpacity: Math.max(item.fillOpacity, 0.78) };
    }),
  };
}

export function sampleLayerColor(layer: StudioLayer) {
  if (layer.type === "path") return layer.color;
  if (layer.type === "text") return layer.color;
  if (layer.type === "shape") return layer.fill !== "none" && layer.fillOpacity > 0 ? layer.fill : layer.stroke;
  return null;
}
