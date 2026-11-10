"use client";

import { CloudOff } from "lucide-react";
import { useOnline } from "@/lib/offline";

/** Thin bar under the top bar while the connection is down. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground"
    >
      <CloudOff aria-hidden className="size-3.5 shrink-0" />
      You&apos;re offline. Saved trips are available to read; editing is paused until you reconnect.
    </div>
  );
}
