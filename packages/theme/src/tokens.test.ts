import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colors, dayColor, dayColors } from "./tokens.ts";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8").toLowerCase();

describe("tokens", () => {
  it("keeps day colours in sync with theme.css", () => {
    dayColors.forEach((hex, i) => {
      expect(css).toContain(`--color-day-${i + 1}: ${hex.toLowerCase()};`);
    });
  });

  it("keeps light-mode core colours in sync with theme.css", () => {
    expect(css).toContain(`--foreground: ${colors.ink.toLowerCase()};`);
    expect(css).toContain(`--border: ${colors.border.toLowerCase()};`);
    expect(css).toContain(`--accent-foreground: ${colors.accent.toLowerCase()};`);
  });

  it("cycles day colours, including negative indexes", () => {
    expect(dayColor(0)).toBe(dayColors[0]);
    expect(dayColor(dayColors.length)).toBe(dayColors[0]);
    expect(dayColor(-1)).toBe(dayColors[dayColors.length - 1]);
  });
});
