import { nanoid } from "nanoid";
import type { ShapeKind, ShapeLayer, StudioLayer, TextLayer } from "./studioTypes";

const shapeNames: Record<ShapeKind, string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  diamond: "Diamond",
  star: "Star",
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

export function shapePoints(shape: ShapeKind, x: number, y: number, width: number, height: number) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  if (shape === "triangle") return `${centerX},${y} ${x + width},${y + height} ${x},${y + height}`;
  if (shape === "diamond") return `${centerX},${y} ${x + width},${centerY} ${centerX},${y + height} ${x},${centerY}`;
  if (shape !== "star") return null;
  const outerRadius = Math.min(Math.abs(width), Math.abs(height)) / 2;
  const innerRadius = outerRadius * 0.45;
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    return `${centerX + Math.cos(angle) * radius},${centerY + Math.sin(angle) * radius}`;
  }).join(" ");
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
