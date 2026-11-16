const imageGenerationPattern =
  /\b(?:generate|create|make|draw|paint|illustrate|design)\b[\s\S]{0,120}\b(?:image|picture|artwork|illustration|photo|photograph|portrait|drawing|painting|wallpaper|logo|icon|graphic)\b/i;

const imageTransformationPattern =
  /\b(?:turn|transform|convert|restyle)\b[\s\S]{0,100}\b(?:into|as)\b/i;
const visualArtActionPattern = /\b(?:draw|paint|illustrate)\b/i;

export function isImageGenerationPrompt(prompt: string): boolean {
  const text = prompt.trim();
  return /^\/image\b/i.test(text) ||
    imageGenerationPattern.test(text) ||
    visualArtActionPattern.test(text) ||
    imageTransformationPattern.test(text);
}
