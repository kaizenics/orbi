"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { ServiceWorker } from "@/components/service-worker";
import { CACHE_MAX_AGE_MS, persister, shouldPersist } from "@/lib/offline";

/**
 * `cacheKey` identifies the signed-in account: saved trips from another account are discarded, so
 * trips never show up for the wrong person on a shared browser.
 */
export function Providers({ children, cacheKey }: { children: React.ReactNode; cacheKey: string }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // gcTime must be at least as long as the saved data lives, or it is dropped from memory first.
          queries: { staleTime: 30_000, retry: 1, gcTime: CACHE_MAX_AGE_MS },
          // Writes fail at once when offline (see lib/api.ts) instead of waiting in a hidden queue.
          mutations: { networkMode: "always" },
        },
      }),
  );
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE_MS,
        buster: cacheKey,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
      }}
    >
      <ServiceWorker />
      <ConfirmProvider>{children}</ConfirmProvider>
    </PersistQueryClientProvider>
  );
}
