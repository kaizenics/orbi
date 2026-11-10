"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { AI_PROVIDERS, aiConnectionSchema, type AiProvider } from "@orbi/core";
import { keyHint, saveAiConnection, useAiConnection } from "@/lib/ai-connection";
import { labelClass } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "./form-select";
import { useConfirm } from "./confirm-dialog";

const PROVIDERS: Record<AiProvider, { label: string; keysUrl: string; modelHint: string }> = {
  openrouter: {
    label: "OpenRouter",
    keysUrl: "https://openrouter.ai/settings/keys",
    modelHint: "Free and low-cost models (under $0.50 per million input tokens), live from OpenRouter.",
  },
  openai: {
    label: "OpenAI",
    keysUrl: "https://platform.openai.com/api-keys",
    modelHint: "OpenAI's low-cost mini and nano models available to your key.",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    keysUrl: "https://console.anthropic.com/settings/keys",
    modelHint: "Claude Haiku models, Anthropic's lowest-cost family.",
  },
  google: {
    label: "Google (Gemini)",
    keysUrl: "https://aistudio.google.com/apikey",
    modelHint: "Gemini Flash models, Google's low-cost family.",
  },
};

/** Bring your own key: saved only in this browser and sent with each AI request. */
export function AiSettingsForm() {
  const current = useAiConnection();
  const confirm = useConfirm();
  const [provider, setProvider] = useState<AiProvider | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [typedKey, setTypedKey] = useState("");
  const selected = provider ?? current?.provider ?? "openrouter";
  const keyRequired = !current || selected !== current.provider;
  const info = PROVIDERS[selected];
  // The key used to list models: the one being typed, else the saved one for this provider.
  const listingKey = typedKey.trim() || (current?.provider === selected ? current.apiKey : "");

  return (
    <section aria-labelledby="ai-settings-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="ai-settings-heading" className="flex items-center gap-2 font-medium">
          <KeyRound aria-hidden className="size-4" /> AI provider
        </h2>
        <p className="text-sm text-muted-foreground">
          AI features use your own API key. It is saved only in this browser and sent with your AI requests;
          the ORBI server never stores it. Usage is billed by your provider to your account. On another device
          or browser, enter it again.
        </p>
      </div>

      {current ? (
        <p role="status" className="rounded-md border bg-muted px-3 py-2 text-sm">
          Connected: {PROVIDERS[current.provider].label} · {current.model} · key {keyHint(current.apiKey)}
        </p>
      ) : null}

      <form
        aria-label="AI provider settings"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const parsed = aiConnectionSchema.safeParse({
            provider: selected,
            model: String(f.get("model") ?? "").trim(),
            apiKey: typedKey.trim() || (keyRequired ? "" : current!.apiKey),
          });
          if (!parsed.success) {
            setMessage({ ok: false, text: "Enter a model ID and an API key of at least 10 characters." });
            return;
          }
          const saved = saveAiConnection(parsed.data);
          setMessage(
            saved
              ? { ok: true, text: "Saved in this browser." }
              : { ok: false, text: "This browser blocks site storage, so the key cannot be saved." },
          );
          if (saved) setTypedKey("");
        }}
      >
        <Label className={labelClass}>
          Provider
          <FormSelect
            name="provider"
            value={selected}
            onValueChange={setProvider}
            options={AI_PROVIDERS.map((p) => ({ value: p, label: PROVIDERS[p].label }))}
          />
        </Label>
        <Label className={labelClass}>
          API key
          <Input
            name="apiKey"
            type="password"
            value={typedKey}
            onChange={(e) => setTypedKey(e.target.value)}
            autoComplete="off"
            required={keyRequired}
            placeholder={keyRequired ? "Paste your key" : `Leave empty to keep ${keyHint(current!.apiKey)}`}
          />
          <a href={info.keysUrl} target="_blank" rel="noreferrer" className="font-normal underline">
            Get a {info.label} key
          </a>
        </Label>
        <ModelPicker
          key={selected}
          provider={selected}
          apiKey={listingKey}
          defaultModel={selected === current?.provider ? current.model : ""}
          hint={info.modelHint}
        />
        {message ? (
          <p role="status" className={`text-sm ${message.ok ? "text-muted-foreground" : "text-destructive"}`}>
            {message.text}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit">Save</Button>
          {current ? (
            <Button
              variant="outline"
              type="button"

              onClick={async () => {
                if (
                  await confirm({
                    title: "Remove your AI key?",
                    description: "AI features stop working in this browser until you add a key again.",
                    confirmLabel: "Remove key",
                    destructive: true,
                  })
                ) {
                  saveAiConnection(null);
                  setMessage({ ok: true, text: "Removed from this browser." });
                }
              }}
            >
              Remove key
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

const CUSTOM = "__custom";

/** Cheap models fetched live from the provider, with a free-text fallback. Submits as "model". */
function ModelPicker({
  provider,
  apiKey,
  defaultModel,
  hint,
}: {
  provider: AiProvider;
  apiKey: string;
  defaultModel: string;
  hint: string;
}) {
  const needsKey = provider !== "openrouter";
  const models = useQuery({
    queryKey: ["ai-models", provider, needsKey ? apiKey : ""],
    enabled: !needsKey || apiKey.length >= 10,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...(needsKey ? { apiKey } : {}) }),
      });
      const body = (await res.json()) as { id: string; label: string; price: string }[] | { detail?: string };
      if (!res.ok || !Array.isArray(body))
        throw new Error((body as { detail?: string }).detail ?? "Could not load models");
      return body;
    },
  });
  const list = models.data ?? [];
  const [choice, setChoice] = useState<string | null>(null);
  const [custom, setCustom] = useState(defaultModel);
  const inList = (id: string) => list.some((m) => m.id === id);
  const value =
    choice ?? (defaultModel ? (inList(defaultModel) ? defaultModel : CUSTOM) : (list[0]?.id ?? CUSTOM));
  const model = value === CUSTOM ? custom : value;

  return (
    <div className="flex flex-col gap-1.5">
      <Label className={labelClass}>
        Model
        {needsKey && apiKey.length < 10 ? (
          <span className="font-normal">
            Enter your API key above to see the cheap models available to you.
          </span>
        ) : models.isPending ? (
          <span className="inline-flex items-center gap-1.5 font-normal">
            <Loader2 aria-hidden className="size-3.5 animate-spin" /> Loading models…
          </span>
        ) : (
          <FormSelect
            aria-label="Model"
            value={value}
            onValueChange={setChoice}
            options={[
              ...list.map((m) => ({ value: m.id, label: <ModelLabel name={m.label} price={m.price} /> })),
              { value: CUSTOM, label: "Custom model ID…" },
            ]}
          />
        )}
      </Label>
      {models.isError ? <p className="text-xs text-destructive">{models.error.message}</p> : null}
      {value === CUSTOM || (needsKey && apiKey.length < 10) ? (
        <Input
          aria-label="Custom model ID"
          maxLength={200}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Model ID, e.g. provider/model-name"
        />
      ) : null}
      <input type="hidden" name="model" value={model} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

const RECOMMENDED = "Recommended · ";

/** "Name · price", with the word "Recommended" in green when the model is one of the picks. */
function ModelLabel({ name, price }: { name: string; price: string }) {
  if (!price.startsWith(RECOMMENDED)) return <>{`${name} · ${price}`}</>;
  // One span: the dropdown row lays out its children with gaps between them.
  return (
    <span>
      {`${name} · `}
      <span className="font-medium text-emerald-600 dark:text-emerald-400">Recommended</span>
      {` · ${price.slice(RECOMMENDED.length)}`}
    </span>
  );
}
