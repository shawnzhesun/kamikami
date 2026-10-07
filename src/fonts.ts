/** Local font stacks shared by the Inspector and Remotion preview/export. */
export const fontFamilies = [
  "Arial",
  "Helvetica",
  "Verdana",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Impact",
] as const;
export type FontFamily = (typeof fontFamilies)[number];
export const DEFAULT_FONT: FontFamily = "Arial";
const fontStacks: Record<FontFamily, string> = {
  Arial: "Arial, sans-serif",
  Helvetica: "Helvetica, Arial, sans-serif",
  Verdana: "Verdana, Geneva, sans-serif",
  "Trebuchet MS": '"Trebuchet MS", Arial, sans-serif',
  Georgia: "Georgia, serif",
  "Times New Roman": '"Times New Roman", Times, serif',
  "Courier New": '"Courier New", Courier, monospace',
  Impact: 'Impact, "Arial Black", sans-serif',
};
export function fontStack(family: FontFamily = DEFAULT_FONT) {
  return fontStacks[family];
}
