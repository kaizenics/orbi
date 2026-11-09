"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Loader2, MapPinned, MessageCircle, Minus, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAiConnection } from "@/lib/ai-connection";
import { clearChat, sendChat, setChatOpen, stopChat, useChat } from "@/lib/chat-store";
import { queryKeys } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Floating travel assistant: streams answers, creates trips from itineraries and edits trips. */
export function TravelChat() {
  const connection = useAiConnection();
  const queryClient = useQueryClient();
  const { messages, busy, open, unread } = useChat();
  const status = messages.at(-1)?.status;
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  // The trip on screen, so "change this trip" works.
  const tripId = usePathname().match(/^\/trips\/([^/]+)/)?.[1];

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  const send = (text: string) => {
    if (!connection) return;
    setInput("");
    // ["trips"] is the prefix of every trip query, so the open trip refreshes too.
    void sendChat(
      text,
      connection,
      tripId,
      () => void queryClient.invalidateQueries({ queryKey: queryKeys.trips }),
    );
  };
  const setOpen = (next: boolean | ((o: boolean) => boolean)) =>
    setChatOpen(typeof next === "function" ? next(open) : next);

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
                Ask, paste an itinerary, or edit a trip
              </p>
            </div>
            {messages.length ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label="Clear chat"
                disabled={busy}
                onClick={clearChat}
              >
                <Trash2 aria-hidden />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label="Minimize chat"
              title="Minimize (replies keep running)"
              onClick={() => setOpen(false)}
            >
              <Minus aria-hidden />
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
                  {m.content || (m.status || m.trip || m.edited ? null : <TypingDots />)}
                  {m.status ? <p className="text-xs text-muted-foreground">{m.status}</p> : null}
                  {m.edited ? (
                    <div className="mt-1 flex flex-col gap-1.5">
                      <p>
                        {m.edited.applied ? (
                          <>
                            Updated <strong>{m.edited.name}</strong> ({m.edited.applied} change
                            {m.edited.applied === 1 ? "" : "s"}).
                          </>
                        ) : (
                          <>
                            No changes were needed in <strong>{m.edited.name}</strong>.
                          </>
                        )}
                      </p>
                      {m.edited.summary ? (
                        <p className="text-xs text-muted-foreground">{m.edited.summary}</p>
                      ) : null}
                      {tripId !== m.edited.id ? (
                        <Button asChild size="sm" className="self-start">
                          <Link href={`/trips/${m.edited.id}`}>Open trip</Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
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
              <Button type="button" size="icon" variant="outline" aria-label="Stop" onClick={stopChat}>
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

      {!open && busy ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-20 z-50 flex max-w-[min(280px,calc(100vw-2rem))] items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm shadow-lg hover:bg-muted"
        >
          <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
          <span role="status" className="truncate">
            {status ?? "ORBI is replying…"}
          </span>
        </button>
      ) : null}
      <Button
        size="icon"
        aria-label={open ? "Minimize chat" : unread ? "Open travel chat (new reply)" : "Open travel chat"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg [&_svg]:size-5"
      >
        {open ? <Minus aria-hidden /> : <MessageCircle aria-hidden />}
        {!open && unread ? (
          <span
            aria-hidden
            className="absolute top-0.5 right-0.5 size-3 rounded-full border-2 border-background bg-emerald-500"
          />
        ) : null}
      </Button>
    </>
  );
}

/** "Thinking" indicator: three dots bouncing in turn, as in other chat apps. */
function TypingDots() {
  return (
    <span role="status" aria-label="ORBI is typing" className="flex h-5 items-center gap-1 px-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 motion-reduce:animate-pulse"
          style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
        />
      ))}
    </span>
  );
}
