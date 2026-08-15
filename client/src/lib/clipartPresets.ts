export const clipartSubjectPresets = [
  { subject: "Math", prompt: "a friendly pencil holding a small addition sign" },
  { subject: "Reading", prompt: "a cheerful owl reading an open book" },
  { subject: "Science", prompt: "a happy beaker with tiny sparkling stars" },
  { subject: "Nature", prompt: "a smiling sprout growing from a tiny pot" },
  { subject: "Social studies", prompt: "a playful globe with a little explorer flag" },
] as const;

export function presetPromptForSubject(subject: string) {
  return clipartSubjectPresets.find((preset) => preset.subject === subject)?.prompt ?? "";
}
