"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, MapPinned, MessageCircle, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAiConnection } from "@/lib/ai-connection";
import { queryKeys } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface CreatedTrip {
  id: string;
  name: string;
  added: number;
  missing: string[];
}
interface Message {
  role: "user" | "assistant";
  content: string;
  trip?: CreatedTrip;
  status?: string;
  error?: boolean;
}

/** Only the latest turns go to the server (it also trims): fewer tokens per answer. */
const SENT_HISTORY = 6;
const STORAGE_KEY = "orbi.chat";
const KEPT_MESSAGES = 60;

/** Saved conversation; half-finished answers from an interrupted stream are dropped. */
const loadMessages = (): Message[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Message[];
    return saved
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && (m.content || m.trip))
      .map(({ status: _status, ...m }) => m);
  } catch {
    return [];
  }
};

/** Floating travel assistant: streams answers and turns a pasted itinerary into a whole trip. */
export function TravelChat() {
  const connection = useAiConnection();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // The conversation lives in this browser (like the AI key), so it survives reloads and restarts.
  // Saving starts only after the saved chat has been put into state (a render later); otherwise the
  // empty first render would be saved over it (React runs effects twice in development).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setMessages(loadMessages());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated && !busy) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-KEPT_MESSAGES)));
      } catch {
        // storage blocked or full: the chat simply starts fresh next time
      }
    }
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, hydrated]);

  const update = (patch: (m: Message) => Message) =>
    setMessages((all) => [...all.slice(0, -1), patch(all.at(-1)!)]);

  async function send(text: string) {
    if (!connection || busy || !text.trim()) return;
    const history: Message[] = [...messages, { role: "user", content: text.trim() }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({
          ai: connection,
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
            error?: string;
          };
          if (event.text) update((m) => ({ ...m, content: m.content + event.text }));
          if (event.status) update((m) => ({ ...m, status: event.status }));
          if (event.error)
            update((m) => ({ ...m, status: undefined, error: true, content: m.content || event.error! }));
          if (event.trip) {
            const trip = event.trip;
            update((m) => ({ ...m, status: undefined, trip }));
            void queryClient.invalidateQueries({ queryKey: queryKeys.trips });
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        update((m) => ({ ...m, error: true, content: m.content || "Something went wrong. Try again." }));
    } finally {
      update((m) => ({ ...m, status: undefined }));
      setBusy(false);
      abort.current = null;
    }
  }

  return (
    <>
      {open ? (
        <section
          aria-label="ORBI travel chat"
          className="fixed right-4 bottom-20 z-50 flex h-[min(560px,calc(100dvh-7rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
        >
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <MapPinned aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">ORBI assistant</p>
              <p className="truncate text-xs text-muted-foreground">
                Travel questions, or paste an itinerary
              </p>
            </div>
            {messages.length ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label="Clear chat"
                disabled={busy}
                onClick={() => setMessages([])}
              >
                <Trash2 aria-hidden />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden />
            </Button>
          </header>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
            {!connection ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Add your AI key in{" "}
                <Link href="/settings?tab=integrations" className="underline">
                  Settings → Integrations
                </Link>{" "}
                to chat. ORBI uses your own provider, so you control the cost.
              </p>
            ) : messages.length === 0 ? (
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p>
                  Ask about places, food, transport or budgets — or paste a day-by-day itinerary and I'll turn
                  it into a trip with every stop on the map.
                </p>
                {["3 days in Kyoto on a budget?", "Best time to visit Palawan?"].map((q) => (
                  <Button
                    key={q}
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => void send(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted",
                    m.error && "text-destructive",
                  )}
                >
                  {m.content || (m.status || m.trip ? null : <span className="animate-pulse">…</span>)}
                  {m.status ? <p className="text-xs text-muted-foreground">{m.status}</p> : null}
                  {m.trip ? (
                    <div className="mt-1 flex flex-col gap-1.5">
                      <p>
                        Created <strong>{m.trip.name}</strong> with {m.trip.added} stop
                        {m.trip.added === 1 ? "" : "s"} on the map.
                      </p>
                      {m.trip.missing.length ? (
                        <p className="text-xs text-muted-foreground">
                          Not found on the map: {m.trip.missing.join(", ")}. Add them with place search.
                        </p>
                      ) : null}
                      <Button asChild size="sm" className="self-start">
                        <Link href={`/trips/${m.trip.id}`} onClick={() => setOpen(false)}>
                          Open trip
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
            <div ref={bottom} />
          </div>

          <form
            className="flex items-end gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <Textarea
              aria-label="Message"
              rows={1}
              value={input}
              disabled={!connection}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask or paste an itinerary…"
              className="max-h-32 min-h-9 resize-none"
            />
            {busy ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Stop"
                onClick={() => abort.current?.abort()}
              >
                <Square aria-hidden />
              </Button>
            ) : (
              <Button type="submit" size="icon" aria-label="Send" disabled={!connection || !input.trim()}>
                <ArrowUp aria-hidden />
              </Button>
            )}
          </form>
        </section>
      ) : null}

      <Button
        size="icon"
        aria-label={open ? "Close chat" : "Open travel chat"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg [&_svg]:size-5"
      >
        {open ? <X aria-hidden /> : <MessageCircle aria-hidden />}
      </Button>
    </>
  );
}
