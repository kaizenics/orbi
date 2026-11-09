"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export type ThemeChoice = Theme | "system";
const STORAGE_KEY = "orbi.theme";

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme:
 * the saved choice, otherwise the system setting.
 */
export const themeInitScript = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

/** The theme in effect right now. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "light");
}

/** What the user picked, including "system". */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, () => "system");
}

export function setTheme(choice: ThemeChoice) {
  const theme =
    choice === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : choice;
  document.documentElement.dataset.theme = theme;
  try {
    if (choice === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // storage blocked: the choice lasts until reload
  }
  listeners.forEach((l) => l());
}
