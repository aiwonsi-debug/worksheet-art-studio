export type AssetKind = "clipart" | "border" | "header" | "drawing" | "upload";
export type StudioTool = "select" | "brush" | "eraser";

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
};

export type StudioLayer = ImageLayer | PathLayer;

export type WorksheetCanvasState = {
  transparentBackground: boolean;
  layers: StudioLayer[];
};

export const WORKSHEET_WIDTH = 920;
export const WORKSHEET_HEIGHT = 1160;

export const createEmptyCanvas = (): WorksheetCanvasState => ({
  transparentBackground: false,
  layers: [],
});
