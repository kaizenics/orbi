"use client";

import { useSyncExternalStore } from "react";
import type { AiConnection } from "@orbi/core";

export interface CreatedTrip {
  id: string;
  name: string;
  added: number;
  missing: string[];
}
export interface EditedTrip {
  id: string;
  name: string;
  summary: string;
  applied: number;
}
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  trip?: CreatedTrip;
  edited?: EditedTrip;
  status?: string;
  error?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  busy: boolean;
  open: boolean;
  /** A reply finished while the panel was minimized. */
  unread: boolean;
}

/** Only the latest turns go to the server (it also trims): fewer tokens per answer. */
const SENT_HISTORY = 6;
const STORAGE_KEY = "orbi.chat";
const KEPT_MESSAGES = 60;
const EMPTY: ChatState = { messages: [], busy: false, open: false, unread: false };

/**
 * The chat lives here, outside React components, so a reply keeps streaming while the user closes
 * the panel or moves to another page, and is there when they come back. The conversation is saved
 * in this browser (like the AI key); the server keeps no history.
 */
let state: ChatState | null = null;
let abort: AbortController | null = null;
const listeners = new Set<() => void>();

function load(): ChatState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as ChatMessage[];
    return {
      ...EMPTY,
      // Half-finished answers from an interrupted reload are dropped.
      messages: saved
        .filter(
          (m) => m && (m.role === "user" || m.role === "assistant") && (m.content || m.trip || m.edited),
        )
        .map(({ status: _status, ...m }) => m),
    };
  } catch {
    return EMPTY;
  }
}

const get = () => (state ??= load());

function set(next: Partial<ChatState>) {
  state = { ...get(), ...next };
  if (!state.busy) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages.slice(-KEPT_MESSAGES)));
    } catch {
      // storage blocked or full: the chat simply starts fresh next time
    }
  }
  listeners.forEach((l) => l());
}

/** Changes the last (assistant) message. */
const patchLast = (patch: (m: ChatMessage) => ChatMessage) => {
  const all = get().messages;
  set({ messages: [...all.slice(0, -1), patch(all.at(-1)!)] });
};

export function useChat(): ChatState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    get,
    () => EMPTY,
  );
}

export const setChatOpen = (open: boolean) => set(open ? { open, unread: false } : { open });
export const clearChat = () => set({ messages: [] });
export const stopChat = () => abort?.abort();

/**
 * Sends a message and streams the reply. `tripId` is the trip on screen ("edit this trip");
 * `onTripsChanged` refreshes cached trip data after the chat creates or edits a trip.
 */
export async function sendChat(
  text: string,
  connection: AiConnection,
  tripId: string | undefined,
  onTripsChanged: (tripId: string) => void,
) {
  if (get().busy || !text.trim()) return;
  if (!navigator.onLine) {
    set({
      messages: [
        ...get().messages,
        { role: "user", content: text.trim() },
        { role: "assistant", content: "You're offline. The assistant needs a connection.", error: true },
      ],
    });
    return;
  }
  const history: ChatMessage[] = [...get().messages, { role: "user", content: text.trim() }];
  set({ messages: [...history, { role: "assistant", content: "" }], busy: true });
  abort = new AbortController();
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abort.signal,
      body: JSON.stringify({
        ai: connection,
        ...(tripId ? { tripId } : {}),
        messages: history
          .filter((m) => m.content && !m.error)
          .slice(-SENT_HISTORY)
          .map(({ role, content }) => ({ role, content: content.slice(0, 8000) })),
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines.filter(Boolean)) {
        const event = JSON.parse(line) as {
          text?: string;
          status?: string;
          trip?: CreatedTrip;
          edited?: EditedTrip;
          error?: string;
        };
        if (event.text) patchLast((m) => ({ ...m, content: m.content + event.text }));
        if (event.status) patchLast((m) => ({ ...m, status: event.status }));
        if (event.error)
          patchLast((m) => ({ ...m, status: undefined, error: true, content: m.content || event.error! }));
        if (event.trip) {
          const trip = event.trip;
          patchLast((m) => ({ ...m, status: undefined, trip }));
          onTripsChanged(trip.id);
        }
        if (event.edited) {
          const edited = event.edited;
          patchLast((m) => ({ ...m, status: undefined, edited }));
          onTripsChanged(edited.id);
        }
      }
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError")
      patchLast((m) => ({ ...m, error: true, content: m.content || "Something went wrong. Try again." }));
  } finally {
    // A reply that ended with nothing in it would leave an empty bubble behind.
    const stopped = abort?.signal.aborted ?? false;
    patchLast((m) =>
      m.content || m.trip || m.edited || m.error
        ? m
        : { ...m, error: !stopped, content: stopped ? "Stopped." : "No answer came back. Try again." },
    );
    abort = null;
    patchLast((m) => ({ ...m, status: undefined }));
    set({ busy: false, unread: !get().open });
  }
}
