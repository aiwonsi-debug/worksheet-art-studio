export function prepareCustomClipartPrompt(value: string) {
  const prompt = value.trim().replace(/\s+/g, " ");
  if (prompt.length < 3) throw new Error("Describe the clipart in at least three characters.");
  return prompt;
}
