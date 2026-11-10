"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import StarBorder from "@/components/StarBorder";
import { useTheme } from "@/lib/theme";

/**
 * Main call to action: a link wrapped in React Bits' StarBorder (a star travelling the outline).
 * The surface is the card color; the star's theme follows the app theme (white star in dark mode,
 * black in light mode) so it contrasts with the page behind it.
 */
export function StarCta({ href, children }: { href: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <StarBorder
      as={Link}
      href={href}
      theme={theme === "dark" ? "dark" : "light"}
      radius={999}
      // Surface, text and outline come from the app's card colors, so they follow light and dark mode.
      backgroundColor="var(--card)"
      textColor="var(--card-foreground)"
      borderColor="var(--border)"
      duration={4}
      thickness={1.5}
      sparkle
      className="group h-12 px-7 text-base"
    >
      {children}
      <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
    </StarBorder>
  );
}
