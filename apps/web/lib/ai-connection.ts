"use client";

import { useSyncExternalStore } from "react";
import { aiConnectionSchema, type AiConnection } from "@orbi/core";

/**
 * The user's AI provider, model and API key, kept only in this browser (localStorage) and sent with
 * each AI request. The ORBI server never stores it.
 * shortcut: any script running on this site could read localStorage; acceptable for a personal app
 * with no third-party scripts. Revisit before adding analytics or other external scripts.
 */
const STORAGE_KEY = "orbi.ai-connection";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: AiConnection | null = null;

function read(): AiConnection | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked (private mode, disabled site data)
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? aiConnectionSchema.parse(JSON.parse(raw)) : null;
    } catch {
      cached = null;
    }
  }
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAiConnection(): AiConnection | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Saves (or with null, forgets) the connection. Returns false when the browser blocks storage. */
export function saveAiConnection(connection: AiConnection | null): boolean {
  try {
    if (connection)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(aiConnectionSchema.parse(connection)));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    return false;
  }
  listeners.forEach((l) => l());
  return true;
}

export const keyHint = (apiKey: string) => `…${apiKey.slice(-4)}`;
