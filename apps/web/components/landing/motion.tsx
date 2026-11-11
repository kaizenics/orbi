"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fades and lifts content in as it enters the viewport (static under reduced motion). */
export function Reveal({
  children,
  delay = 0,
  className,
  y = 24,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Hero headline: each line rises out of a mask, one after the other. */
export function HeroLines({ lines, className }: { lines: string[]; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <h1 className={className}>
      {lines.map((line, i) => (
        <span key={line} className="block overflow-hidden pb-1">
          <motion.span
            className="block"
            initial={reduce ? false : { y: "110%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease: EASE }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

/**
 * Hero devices: the planner in a desktop browser window with a phone in front of it. Both enter
 * with a tilt, then drift at different speeds on scroll for depth. Real screenshots inside CSS frames.
 */
export function HeroVisual({ desktop, mobile }: { desktop: React.ReactNode; mobile: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [40, -60]), { stiffness: 120, damping: 30 });
  const phoneY = useSpring(useTransform(scrollYProgress, [0, 1], [90, -140]), {
    stiffness: 120,
    damping: 30,
  });

  return (
    <div ref={ref} className="relative pb-10 [perspective:1600px] md:pr-16">
      <motion.div
        style={reduce ? undefined : { y }}
        initial={reduce ? false : { opacity: 0, rotateX: 14, rotateY: -10, scale: 0.94 }}
        animate={{ opacity: 1, rotateX: 4, rotateY: -6, scale: 1 }}
        transition={{ duration: 1.2, delay: 0.25, ease: EASE }}
        className="origin-left overflow-hidden rounded-xl border bg-card shadow-[0_40px_80px_-30px_rgb(0_0_0/0.35)]"
      >
        <div aria-hidden className="flex items-center gap-3 border-b bg-muted/60 px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-foreground/20" />
            <span className="size-2.5 rounded-full bg-foreground/20" />
            <span className="size-2.5 rounded-full bg-foreground/20" />
          </span>
          <span className="mx-auto w-1/2 truncate rounded-md bg-background px-3 py-1 text-center text-[11px] text-muted-foreground">
            orbi.kaizenics.dev/trips
          </span>
          <span className="w-12" />
        </div>
        {desktop}
      </motion.div>
      <motion.div
        style={reduce ? undefined : { y: phoneY }}
        initial={reduce ? false : { opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.7, ease: EASE }}
        className="absolute right-0 -bottom-6 w-[30%] max-w-56 min-w-36"
      >
        <div className="rounded-[2.2rem] bg-zinc-900 p-2 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.5)] ring-1 ring-zinc-700">
          <div className="relative overflow-hidden rounded-[1.7rem] bg-card">
            <span
              aria-hidden
              className="absolute top-2 left-1/2 z-10 h-4 w-14 -translate-x-1/2 rounded-full bg-zinc-900"
            />
            {mobile}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export type StackItem = {
  title: string;
  body: string;
  /** Right-hand side of the card, usually a <Shot>. */
  visual: React.ReactNode;
  /** Visual tone of the card: dark photo card or light product-shot card. */
  tone: "dark" | "light";
};

/**
 * App screenshot in the site's theme: `/landing/<name>-light.png` and `-dark.png`, one hidden by CSS.
 * Pass width/height for an intrinsic-size image, or neither to fill the parent.
 */
export function Shot({
  name,
  alt,
  sizes,
  className,
  width,
  height,
  priority,
}: {
  name: string;
  alt: string;
  sizes: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}) {
  const size = width && height ? { width, height } : { fill: true };
  return (
    <>
      <Image
        src={`/landing/${name}-light.png`}
        alt={alt}
        sizes={sizes}
        priority={priority}
        {...size}
        className={cn(className, "dark:hidden")}
      />
      <Image
        src={`/landing/${name}-dark.png`}
        alt={alt}
        sizes={sizes}
        priority={priority}
        {...size}
        className={cn(className, "hidden dark:block")}
      />
    </>
  );
}

/**
 * Scroll-stacked feature cards: each card pins under the header and the next slides over it, while
 * the ones beneath shrink and dim (depth). Plain stacked cards under reduced motion.
 */
export function StackCards({ items }: { items: StackItem[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  return (
    <ol ref={ref} className="relative flex flex-col gap-8 pb-[10vh]">
      {items.map((item, i) => (
        <StackCard key={item.title} item={item} i={i} n={items.length} progress={scrollYProgress} />
      ))}
    </ol>
  );
}

function StackCard({
  item,
  i,
  n,
  progress,
}: {
  item: StackItem;
  i: number;
  n: number;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const reduce = useReducedMotion();
  const scale = useTransform(progress, [i / n, 1], [1, 1 - (n - 1 - i) * 0.05]);
  const dim = useTransform(progress, [i / n, 1], [0, (n - 1 - i) * 0.18]);
  const dark = item.tone === "dark";

  return (
    <li className="sticky h-[78dvh] min-h-[30rem]" style={{ top: `calc(6rem + ${i * 1.75}rem)` }}>
      <motion.article
        style={reduce ? undefined : { scale }}
        className={cn(
          "relative grid h-full origin-top overflow-hidden rounded-[2rem] shadow-[0_-20px_60px_-30px_rgb(0_0_0/0.45)] md:grid-cols-[2fr_3fr]",
          dark ? "bg-zinc-950 text-zinc-50" : "border bg-card",
        )}
      >
        <div className="relative z-10 flex flex-col justify-between gap-6 p-8 md:p-12">
          <span
            className={cn("font-mono text-sm tabular-nums", dark ? "text-zinc-500" : "text-muted-foreground")}
          >
            {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
          </span>
          <div>
            <h3 className="font-heading text-3xl font-bold tracking-tight text-balance md:text-5xl">
              {item.title}
            </h3>
            <p
              className={cn(
                "mt-4 max-w-[38ch] text-base leading-relaxed md:text-lg",
                dark ? "text-zinc-400" : "text-muted-foreground",
              )}
            >
              {item.body}
            </p>
          </div>
        </div>
        <div
          className={cn(
            "relative min-h-56 overflow-hidden",
            dark ? "" : "bg-muted md:mt-12 md:ml-4 md:rounded-tl-2xl md:border-t md:border-l",
          )}
        >
          {item.visual}
          {dark && (
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/20 to-transparent max-md:bg-gradient-to-b"
            />
          )}
        </div>
        {!reduce && (
          <motion.div
            aria-hidden
            style={{ opacity: dim }}
            className="pointer-events-none absolute inset-0 bg-black"
          />
        )}
      </motion.article>
    </li>
  );
}

/** Full-bleed photo band: the image scales down slightly as it scrolls through (zoom parallax). */
export function PhotoBand({ src, alt, children }: { src: string; alt: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.18, 1]);

  return (
    <section ref={ref} className="relative isolate flex min-h-[80dvh] items-end overflow-hidden">
      <motion.div style={reduce ? undefined : { scale }} className="absolute inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed photo */}
        <img src={src} alt={alt} className="size-full object-cover grayscale" loading="lazy" />
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      {children}
    </section>
  );
}

/** Primary CTA with a tactile press and a sliding arrow. */
export function PressButton({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.span
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.span>
  );
}
