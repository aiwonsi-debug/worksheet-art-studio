export type AssetKind = "clipart" | "border" | "header" | "drawing" | "upload";
export type StudioTool = "select" | "brush" | "eraser" | "rectangle" | "ellipse" | "triangle" | "diamond" | "star" | "line" | "arrow" | "text" | "bucket" | "eyedropper";

export type ImageLayer = {
  id: string;
  type: "image";
  name: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  /** Imported PDF pages are kept in place while users annotate above them. */
  locked?: boolean;
};

export type PathLayer = {
  id: string;
  type: "path";
  name: string;
  d: string;
  color: string;
  strokeWidth: number;
  mode: "draw" | "erase";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  points?: StrokePoint[];
  /** Curve-fit amount captured when this freehand stroke was created. */
  smoothing?: number;
};

export type StrokePoint = {
  x: number;
  y: number;
  size: number;
};

export type ShapeKind = "rectangle" | "ellipse" | "triangle" | "diamond" | "star" | "line" | "arrow";

export type ShapeLayer = {
  id: string;
  type: "shape";
  name: string;
  shape: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
};

export type TextLayer = {
  id: string;
  type: "text";
  name: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  color: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
};

export type StudioLayer = ImageLayer | PathLayer | ShapeLayer | TextLayer;

export type WorksheetCanvasState = {
  transparentBackground: boolean;
  darkPaper: boolean;
  layers: StudioLayer[];
};

export const WORKSHEET_WIDTH = 920;
export const WORKSHEET_HEIGHT = 1160;

export const createEmptyCanvas = (): WorksheetCanvasState => ({
  transparentBackground: false,
  darkPaper: false,
  layers: [],
});
