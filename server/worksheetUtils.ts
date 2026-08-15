export const ASSET_KINDS = ["clipart", "border", "header", "drawing", "upload"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export function normalizeWorksheetTitle(title: string) {
  const normalized = title.trim().replace(/\s+/g, " ");
  return normalized || "Untitled worksheet";
}

export const ASSET_NAME_LIMIT = 160;

export function normalizeAssetName(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ");
  const shortened = normalized.slice(0, ASSET_NAME_LIMIT).trim();
  return shortened || "Untitled asset";
}

export function assertOwnedResource(ownerId: number, requesterId: number) {
  if (ownerId !== requesterId) throw new Error("The requested resource does not belong to this user.");
}

export function decodeImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Please provide a valid image data URL.");
  const [, mimeType, payload] = match;
  const bytes = Buffer.from(payload, "base64");
  if (bytes.length === 0 || bytes.length > 12 * 1024 * 1024) throw new Error("Image uploads must be between 1 byte and 12 MB.");
  return { bytes, mimeType };
}

export function buildWorksheetAssetPrompt(input: { prompt: string; kind: Exclude<AssetKind, "drawing" | "upload">; style?: string }) {
  const subject = input.prompt.trim();
  const typeDirection = input.kind === "border"
    ? "a decorative, print-safe worksheet border with generous empty center space"
    : input.kind === "header"
      ? "a horizontal worksheet header illustration with generous empty space for a teacher to add a title"
      : "a single, clearly silhouetted clipart illustration";
  return `Create ${typeDirection} for an educational worksheet. Subject: ${subject}. Style: ${input.style?.trim() || "warm, clean, friendly hand-drawn vector illustration"}. Use crisp contours, simple colors, child-friendly proportions, and print-ready detail. Background must be truly transparent with clean alpha edges, no drop shadow, and no colored fringe. Do not include any words, numbers, letters, watermarks, page background, or frame outside the requested asset.`;
}
