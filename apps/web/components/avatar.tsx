"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Google profile photo, or the first letter of the name when there is none (or it fails to load). */
export function Avatar({
  name,
  picture,
  className,
}: {
  name: string;
  picture: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const base = cn("inline-flex size-8 shrink-0 overflow-hidden rounded-full", className);
  if (picture && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote profile photo; next/image would need a remotePatterns entry and adds nothing at this size
      <img
        src={picture}
        alt=""
        // Google profile photos can refuse requests that carry a referrer.
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn(base, "object-cover")}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        base,
        "items-center justify-center bg-primary text-sm font-semibold text-primary-foreground uppercase",
      )}
    >
      {name.trim()[0] ?? "?"}
    </span>
  );
}
