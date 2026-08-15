import { nanoid } from "nanoid";
import type { ShapeKind, ShapeLayer, StudioLayer, TextLayer } from "./studioTypes";

const shapeNames: Record<ShapeKind, string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  arrow: "Arrow",
};

export function createShapeLayer(shape: ShapeKind, id = nanoid()): ShapeLayer {
  const lineLike = shape === "line" || shape === "arrow";
  return {
    id,
    type: "shape",
    name: shapeNames[shape],
    shape,
    x: 250,
    y: lineLike ? 420 : 380,
    width: lineLike ? 360 : 260,
    height: lineLike ? 0 : 170,
    rotation: 0,
    opacity: 1,
    fill: lineLike ? "none" : "#dfeccf",
    fillOpacity: lineLike ? 0 : 0.78,
    stroke: "#42634f",
    strokeWidth: lineLike ? 7 : 5,
  };
}

export function createTextLayer(id = nanoid()): TextLayer {
  return {
    id,
    type: "text",
    name: "Text label",
    text: "Add your text",
    x: 220,
    y: 260,
    width: 430,
    height: 58,
    rotation: 0,
    opacity: 1,
    color: "#294c3d",
    fontSize: 42,
    fontWeight: "bold",
  };
}

export function layerKindLabel(layer: StudioLayer) {
  if (layer.type === "image") return "Image";
  if (layer.type === "path") return layer.mode === "erase" ? "Transparent erase" : "Drawing";
  if (layer.type === "text") return "Text";
  return layer.shape === "arrow" ? "Arrow" : layer.shape[0].toUpperCase() + layer.shape.slice(1);
}
