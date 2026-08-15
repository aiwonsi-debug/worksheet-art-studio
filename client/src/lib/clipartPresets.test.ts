import { describe, expect, it } from "vitest";
import { clipartSubjectPresets, presetPromptForSubject } from "./clipartPresets";

describe("clipart subject presets", () => {
  it("provides polished prompt starters for core worksheet subjects", () => {
    expect(clipartSubjectPresets.map((preset) => preset.subject)).toEqual(["Math", "Reading", "Science", "Nature", "Social studies"]);
    expect(presetPromptForSubject("Science")).toContain("beaker");
  });

  it("does not overwrite the prompt for an unknown subject", () => {
    expect(presetPromptForSubject("Music")).toBe("");
  });
});
