"use client";

import { useEffect, useState } from "react";
import { createOrbiClient } from "@orbi/api/client";
import { healthResponseSchema } from "@orbi/core";

type Status = { state: "checking" } | { state: "online"; version: string } | { state: "offline" };

export function ServerStatus() {
  const [status, setStatus] = useState<Status>({ state: "checking" });

  useEffect(() => {
    const client = createOrbiClient(`${window.location.origin}/api`);
    let cancelled = false;

    client.health
      .$get()
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return healthResponseSchema.parse(await res.json());
      })
      .then((health) => !cancelled && setStatus({ state: "online", version: health.version }))
      .catch(() => !cancelled && setStatus({ state: "offline" }));

    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    status.state === "online"
      ? `Server online · v${status.version}`
      : status.state === "offline"
        ? "Server offline"
        : "Checking server…";

  return (
    <p role="status" className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
      <span
        aria-hidden
        className={`size-2 rounded-full ${
          status.state === "online" ? "bg-day-3" : status.state === "offline" ? "bg-destructive" : "bg-border"
        }`}
      />
      {label}
    </p>
  );
}
