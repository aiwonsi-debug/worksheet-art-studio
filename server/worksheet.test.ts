import { describe, expect, it } from "vitest";
import { ASSET_NAME_LIMIT, assertOwnedResource, buildWorksheetAssetPrompt, decodeImageDataUrl, normalizeAssetName, normalizeWorksheetTitle } from "./worksheetUtils";

describe("worksheet safeguards", () => {
  it("normalizes a project title without allowing an empty project name", () => {
    expect(normalizeWorksheetTitle("  My   weather  page  ")).toBe("My weather page");
    expect(normalizeWorksheetTitle("  ")).toBe("Untitled worksheet");
  });

  it("shortens a long asset name while retaining a safe readable label", () => {
    const detailedPrompt = "cute black-and-white doodle of a smiling cat sitting with its tail curled around its paws, simple bold ink outlines, minimal child-friendly worksheet clipart, no shading, no text, transparent background";
    const repeatedPrompt = `${detailedPrompt} ${detailedPrompt}`;

    expect(normalizeAssetName(repeatedPrompt)).toHaveLength(ASSET_NAME_LIMIT);
    expect(normalizeAssetName("  cheerful   apple  ")).toBe("cheerful apple");
    expect(normalizeAssetName("   ")).toBe("Untitled asset");
  });

  it("does not permit one user to access another user’s resource", () => {
    expect(() => assertOwnedResource(9, 12)).toThrow("does not belong");
    expect(() => assertOwnedResource(9, 9)).not.toThrow();
  });

  it("creates transparent, text-free guidance for generated worksheet assets", () => {
    const prompt = buildWorksheetAssetPrompt({ kind: "clipart", prompt: "cheerful fox reading", style: "paper-cut illustration" });
    expect(prompt).toContain("truly transparent");
    expect(prompt).toContain("Do not include any words");
    expect(prompt).toContain("cheerful fox reading");
  });

  it("decodes a valid image data URL and rejects malformed payloads", () => {
    const image = decodeImageDataUrl("data:image/png;base64,aGVsbG8=");
    expect(image.mimeType).toBe("image/png");
    expect(image.bytes.toString()).toBe("hello");
    expect(() => decodeImageDataUrl("not-a-data-url")).toThrow("valid image data URL");
  });
});
