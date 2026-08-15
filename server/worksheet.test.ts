import { describe, expect, it } from "vitest";
import { assertOwnedResource, buildWorksheetAssetPrompt, decodeImageDataUrl, normalizeWorksheetTitle } from "./worksheetUtils";

describe("worksheet safeguards", () => {
  it("normalizes a project title without allowing an empty project name", () => {
    expect(normalizeWorksheetTitle("  My   weather  page  ")).toBe("My weather page");
    expect(normalizeWorksheetTitle("  ")).toBe("Untitled worksheet");
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

