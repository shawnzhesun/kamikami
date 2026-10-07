export const THEME_STORAGE_KEY = "kamikami-theme";
export const themes = [
  {
    id: "original",
    name: "Original",
    number: 1,
    description: "Warm cream and coral",
    colors: ["#F5EBDD", "#F2765E", "#315B8C", "#413333"],
    scheme: "light",
  },
  {
    id: "coastal",
    name: "Olive",
    number: 2,
    description: "Soft olive and warm cream",
    colors: ["#41431B", "#AEB784", "#E3DBBB", "#F8F3E1"],
    scheme: "light",
  },
  {
    id: "daylight",
    name: "Daylight",
    number: 3,
    description: "Ocean blue and warm ivory",
    colors: ["#3368A0", "#66A3BF", "#C8DFDB", "#F2EFE7"],
    scheme: "light",
  },
  {
    id: "dusk",
    name: "Dusk",
    number: 4,
    description: "Charcoal and muted rose",
    colors: ["#37353E", "#44444E", "#715A5A", "#D3DAD9"],
    scheme: "dark",
  },
] as const;
export type ThemeId = (typeof themes)[number]["id"];
export function resolveTheme(value: string | null): ThemeId {
  return themes.find((theme) => theme.id === value)?.id ?? "original";
}
export function readTheme(): ThemeId {
  try {
    return resolveTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "original";
  }
}
export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  document.documentElement.style.colorScheme = themes.find(
    (theme) => theme.id === id,
  )!.scheme;
}
