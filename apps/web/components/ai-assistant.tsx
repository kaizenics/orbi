"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, MapPinOff, Sparkles } from "lucide-react";
import type { Proposal, ProposedStop, TripAggregate } from "@orbi/core";
import Link from "next/link";
import { ApiError } from "@orbi/api/client";
import { useAiActions } from "@/lib/mutations";
import { useAiConnection } from "@/lib/ai-connection";
import { formatMinutes, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface AiAssistantProps {
  data: TripAggregate;
  /** Resolved, still-selected draft stops to preview on the map. */
  onPreview: (stops: { dayId: string; stop: ProposedStop }[] | null) => void;
}

/** AI proposes, the user decides: nothing is saved until "Apply". */
export function AiAssistant({ data, onPreview }: AiAssistantProps) {
  const connection = useAiConnection();
  const actions = useAiActions(data.trip.id);
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const hasStops = data.days.some((d) => d.items.length > 0);
  const busy = actions.draft.isPending || actions.edit.isPending;
  const error = actions.draft.error ?? actions.edit.error ?? actions.apply.error;

  const open = (p: Proposal) => {
    setProposal(p);
    // Stops without a verified location can never be applied: pre-exclude them.
    setExcluded(
      new Set(
        p.payload.kind === "draft"
          ? p.payload.days.flatMap((d) =>
              d.stops.filter((s) => !s.activityType && !s.location).map((s) => s.key),
            )
          : p.payload.operations.flatMap((op, i) =>
              op.op === "add" && !op.stop.location ? [String(i)] : [],
            ),
      ),
    );
  };
  const close = () => {
    setProposal(null);
    onPreview(null);
  };

  useEffect(() => {
    if (proposal?.payload.kind !== "draft") return onPreview(null);
    onPreview(
      proposal.payload.days.flatMap((d) =>
        d.stops.filter((s) => s.location && !excluded.has(s.key)).map((stop) => ({ dayId: d.dayId, stop })),
      ),
    );
  }, [proposal, excluded, onPreview]);

  const toggle = (key: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!connection) {
    return (
      <section
        aria-labelledby="ai-heading"
        className="flex flex-col gap-1 rounded-lg border border-dashed p-4 text-sm"
      >
        <h2 id="ai-heading" className="font-medium">
          AI assistant
        </h2>
        <p className="text-muted-foreground">
          Add your own AI API key (OpenRouter, OpenAI, Anthropic or Google) in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          to draft and edit itineraries with AI. Everything else works without it.
        </p>
      </section>
    );
  }

  const stale = error instanceof ApiError && error.status === 409;

  return (
    <section aria-labelledby="ai-heading" className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 id="ai-heading" className="flex items-center gap-2 text-sm font-medium">
        <Sparkles aria-hidden className="size-4" /> AI assistant
        <span className="font-normal text-muted-foreground">· {connection.model}</span>
      </h2>

      {!proposal ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const mode = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
            if (mode === "edit")
              actions.edit.mutate({ instruction: text.trim(), ai: connection }, { onSuccess: open });
            else actions.draft.mutate({ prompt: text.trim(), ai: connection }, { onSuccess: open });
          }}
        >
          <Label htmlFor="ai-text" className="sr-only">
            Describe your trip or the change you want
          </Label>
          <Textarea
            id="ai-text"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              hasStops
                ? "e.g. Make day 2 less tiring, or add a seafood restaurant near the fort"
                : "e.g. Historical attractions, local food and a beach day within ₱10,000"
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              value="draft"

              disabled={busy || text.trim().length < 5}
            >
              Draft days
            </Button>
            {hasStops ? (
              <Button
                variant="outline"
                type="submit"
                value="edit"

                disabled={busy || text.trim().length < 3}
              >
                Suggest edits
              </Button>
            ) : null}
            {busy ? (
              <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 aria-hidden className="size-3.5 animate-spin" /> Thinking and looking up places —
                this can take a minute…
              </span>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm">{proposal.payload.summary}</p>

          {proposal.payload.kind === "draft" ? (
            proposal.payload.days.map((day) => {
              const n = data.days.findIndex((d) => d.id === day.dayId) + 1;
              return (
                <fieldset key={day.dayId} className="flex flex-col gap-1">
                  <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Day {n} · {day.title}
                  </legend>
                  {day.stops.map((s) => (
                    <label key={s.key} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                      <Checkbox
                        className="mt-0.5"
                        disabled={!s.activityType && !s.location}
                        checked={!excluded.has(s.key)}
                        onCheckedChange={() => toggle(s.key)}
                      />
                      <span className="flex flex-col">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatMinutes(s.visitDurationMin)}
                          {s.estCostMinor !== null
                            ? ` · ~${formatMoney(s.estCostMinor, data.trip.currency)} (AI estimate, unverified)`
                            : ""}
                          {" · "}
                          {s.why}
                        </span>
                        {s.activityType ? (
                          <span className="text-xs text-muted-foreground">
                            Activity · no map location needed
                          </span>
                        ) : s.location ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin aria-hidden className="size-3" /> {s.location.address ?? s.location.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive">
                            <MapPinOff aria-hidden className="size-3" /> Needs location — not found by the
                            geocoder, cannot be added
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </fieldset>
              );
            })
          ) : (
            <ul className="flex flex-col gap-1">
              {proposal.payload.operations.map((op, i) => (
                <li key={i}>
                  <label className="flex items-start gap-2 rounded-md border p-2 text-sm">
                    <Checkbox
                      className="mt-0.5"
                      disabled={op.op === "add" && !op.stop.location}
                      checked={!excluded.has(String(i))}
                      onCheckedChange={() => toggle(String(i))}
                    />
                    <span>{describeOperation(op, data)}</span>
                  </label>
                </li>
              ))}
              {proposal.payload.rejected.map((r) => (
                <li key={r} className="text-xs text-muted-foreground">
                  Ignored: {r}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Button
              type="button"

              disabled={actions.apply.isPending}
              onClick={() =>
                actions.apply.mutate({ id: proposal.id, exclude: [...excluded] }, { onSuccess: close })
              }
            >
              Apply selected
            </Button>
            <Button
              variant="outline"
              type="button"

              onClick={() => {
                actions.discard.mutate(proposal.id);
                close();
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {stale
            ? "The trip changed since this suggestion was made. Discard it and ask again."
            : error.message}
        </p>
      ) : null}
    </section>
  );
}

function describeOperation(
  op: Extract<Proposal["payload"], { kind: "edit" }>["operations"][number],
  data: TripAggregate,
) {
  const items = data.days.flatMap((d, i) => d.items.map((item) => ({ item, day: i + 1 })));
  const nameOf = (itemId: string) => {
    const found = items.find((x) => x.item.id === itemId);
    return data.destinations.find((d) => d.id === found?.item.destinationId)?.name ?? "a stop";
  };
  const dayOf = (dayId: string) => data.days.findIndex((d) => d.id === dayId) + 1;
  switch (op.op) {
    case "move":
      return `Move ${nameOf(op.itemId)} to day ${dayOf(op.toDayId)}, position ${op.toPosition + 1}`;
    case "remove":
      return `Remove ${nameOf(op.itemId)}`;
    case "add":
      return op.stop.location
        ? `Add ${op.stop.name} to day ${dayOf(op.dayId)} (${op.stop.why})`
        : `Add ${op.stop.name} — needs location, cannot be applied`;
    case "update":
      return `Update ${nameOf(op.itemId)}: ${
        [
          op.visitDurationMin !== null ? `${op.visitDurationMin} min` : null,
          op.fixedStartTime ? `arrive ${op.fixedStartTime}` : null,
          op.notes ? `note "${op.notes}"` : null,
        ]
          .filter(Boolean)
          .join(", ") || "no change"
      }`;
  }
}
