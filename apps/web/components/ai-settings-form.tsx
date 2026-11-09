"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { AI_PROVIDERS, aiConnectionSchema, type AiProvider } from "@orbi/core";
import { keyHint, saveAiConnection, useAiConnection } from "@/lib/ai-connection";
import { inputClass, labelClass, primaryButton, secondaryButton } from "@/lib/ui";

const PROVIDERS: Record<AiProvider, { label: string; keysUrl: string; modelHint: string }> = {
  openrouter: {
    label: "OpenRouter",
    keysUrl: "https://openrouter.ai/settings/keys",
    modelHint: "Model ID from openrouter.ai/models (IDs ending in :free cost nothing)",
  },
  openai: {
    label: "OpenAI",
    keysUrl: "https://platform.openai.com/api-keys",
    modelHint: "Model ID from your OpenAI account",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    keysUrl: "https://console.anthropic.com/settings/keys",
    modelHint: "Claude model ID from the Anthropic console",
  },
  google: {
    label: "Google (Gemini)",
    keysUrl: "https://aistudio.google.com/apikey",
    modelHint: "Gemini model ID from Google AI Studio",
  },
};

/** Bring your own key: saved only in this browser and sent with each AI request. */
export function AiSettingsForm() {
  const current = useAiConnection();
  const [provider, setProvider] = useState<AiProvider | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const selected = provider ?? current?.provider ?? "openrouter";
  const keyRequired = !current || selected !== current.provider;
  const info = PROVIDERS[selected];

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
          const form = e.currentTarget;
          const f = new FormData(form);
          const typedKey = String(f.get("apiKey") ?? "").trim();
          const parsed = aiConnectionSchema.safeParse({
            provider: selected,
            model: String(f.get("model") ?? "").trim(),
            apiKey: typedKey || (keyRequired ? "" : current!.apiKey),
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
          if (saved) form.reset();
        }}
      >
        <label className={labelClass}>
          Provider
          <select
            name="provider"
            value={selected}
            onChange={(e) => setProvider(e.target.value as AiProvider)}
            className={inputClass}
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDERS[p].label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Model
          <input
            key={`${selected}-${current?.model ?? ""}`}
            name="model"
            required
            maxLength={200}
            defaultValue={selected === current?.provider ? current.model : ""}
            className={inputClass}
          />
          <span className="font-normal">{info.modelHint}</span>
        </label>
        <label className={labelClass}>
          API key
          <input
            name="apiKey"
            type="password"
            autoComplete="off"
            required={keyRequired}
            placeholder={keyRequired ? "Paste your key" : `Leave empty to keep ${keyHint(current!.apiKey)}`}
            className={inputClass}
          />
          <a href={info.keysUrl} target="_blank" rel="noreferrer" className="font-normal underline">
            Get a {info.label} key
          </a>
        </label>
        {message ? (
          <p role="status" className={`text-sm ${message.ok ? "text-muted-foreground" : "text-destructive"}`}>
            {message.text}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button type="submit" className={primaryButton}>
            Save
          </button>
          {current ? (
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                if (window.confirm("Remove your AI key from this browser?")) {
                  saveAiConnection(null);
                  setMessage({ ok: true, text: "Removed from this browser." });
                }
              }}
            >
              Remove key
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
