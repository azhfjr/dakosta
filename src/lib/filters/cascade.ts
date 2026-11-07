import {
  isMainTheme,
  isSubTheme,
  type MainTheme,
  type SubTheme,
} from "@/lib/taxonomy";

/**
 * The current schema stores `mainTheme` and `subTheme` as independent columns;
 * there is no parent/child relation between them. When a relation is added,
 * populate this map and the cascade will drop invalid sub-themes automatically.
 */
const SUB_THEMES_BY_MAIN_THEME: Record<MainTheme, readonly SubTheme[] | null> =
  {
    EDUFAST: null,
    NON_EDUFAST: null,
  };

export function subThemesForMainTheme(
  mainTheme: MainTheme | null,
): readonly SubTheme[] {
  if (!mainTheme) return [];
  return SUB_THEMES_BY_MAIN_THEME[mainTheme] ?? [];
}

export function resolveThemeCascade(
  mainTheme: string | undefined,
  subTheme: string | undefined,
): { mainTheme: MainTheme | null; subTheme: SubTheme | null } {
  const theme = isMainTheme(mainTheme) ? mainTheme : null;
  const sub = isSubTheme(subTheme) ? subTheme : null;
  const allowed = subThemesForMainTheme(theme);
  return {
    mainTheme: theme,
    subTheme: allowed.length > 0 && sub && !allowed.includes(sub) ? null : sub,
  };
}
