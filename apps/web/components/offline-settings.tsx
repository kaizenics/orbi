"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudDownload, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  clearOfflineData,
  saveAllTrips,
  savedSummary,
  setOfflineEnabled,
  storageUsedBytes,
  useOfflineEnabled,
  useOnline,
} from "@/lib/offline";
import { useConfirm } from "./confirm-dialog";
import { SettingRow } from "./settings-panels";

const megabytes = (bytes: number) => `${Math.max(0.1, bytes / 1_048_576).toFixed(1)} MB`;

/** Settings → Offline: turn saving on or off, save everything now, see what is stored, clear it. */
export function OfflineSettings() {
  const enabled = useOfflineEnabled();
  const online = useOnline();
  const client = useQueryClient();
  const confirm = useConfirm();
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [summary, setSummary] = useState(() => savedSummary(client));
  const [used, setUsed] = useState<number | null>(null);

  const refresh = () => {
    setSummary(savedSummary(client));
    void storageUsedBytes().then(setUsed);
  };
  useEffect(() => {
    refresh();
    // The query cache changes as pages load; re-read it when it does.
    return client.getQueryCache().subscribe(() => setSummary(savedSummary(client)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh only reads from the stable client
  }, []);

  return (
    <>
      <SettingRow
        label="Save trips for offline use"
        description="Keeps your trips, days and routes on this device so you can read them without a connection."
      >
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label="Save trips for offline use"
          value={enabled ? "on" : "off"}
          onValueChange={(v) => v && void setOfflineEnabled(v === "on").then(refresh)}
        >
          <ToggleGroupItem value="on" className="px-4">
            On
          </ToggleGroupItem>
          <ToggleGroupItem value="off" className="px-4">
            Off
          </ToggleGroupItem>
        </ToggleGroup>
      </SettingRow>

      {enabled ? (
        <>
          <SettingRow
            label={online ? "You're online" : "You're offline"}
            description={
              <>
                {summary.trips === 0 && summary.details === 0
                  ? "No trips are saved on this device yet."
                  : `${summary.details} of ${summary.trips} trip${summary.trips === 1 ? "" : "s"} saved, with ${summary.routes} day route${summary.routes === 1 ? "" : "s"}.`}
                {used !== null ? ` About ${megabytes(used)} used by ORBI on this device.` : ""}
              </>
            }
          >
            <Button
              variant="outline"
              disabled={!online || saving !== null}
              onClick={() => {
                setMessage(null);
                setSaving({ done: 0, total: 0 });
                saveAllTrips(client, (done, total) => setSaving({ done, total }))
                  .then(() => setMessage({ ok: true, text: "All your trips are saved on this device." }))
                  .catch((e: unknown) =>
                    setMessage({
                      ok: false,
                      text: e instanceof Error ? e.message : "Could not save your trips.",
                    }),
                  )
                  .finally(() => {
                    setSaving(null);
                    refresh();
                  });
              }}
            >
              {saving ? <Loader2 aria-hidden className="animate-spin" /> : <CloudDownload aria-hidden />}
              {saving ? `Saving ${saving.done} of ${saving.total}…` : "Save all my trips now"}
            </Button>
          </SettingRow>
          {message ? (
            <p
              role="status"
              className={`px-1 text-sm ${message.ok ? "text-muted-foreground" : "text-destructive"}`}
            >
              {message.text}
            </p>
          ) : null}

          <SettingRow
            label="Saved data"
            description="Removes saved trips, pages and map tiles from this device. Your trips stay in your account."
          >
            <Button
              variant="outline"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Clear saved data?",
                    description: "Trips will need a connection to open until they are saved again.",
                    confirmLabel: "Clear",
                    destructive: true,
                  })
                ) {
                  client.removeQueries();
                  await clearOfflineData();
                  refresh();
                  setMessage({ ok: true, text: "Saved data cleared." });
                }
              }}
            >
              <Trash2 aria-hidden /> Clear saved data
            </Button>
          </SettingRow>
        </>
      ) : null}

      <div className="rounded-xl border-l-4 border-foreground/70 bg-muted/50 px-4 py-3 text-sm">
        <p className="font-medium">What works offline</p>
        <p className="mt-1 text-muted-foreground">
          You can open and read saved trips: days, stops, times, routes, and the map areas you have already
          viewed. Editing, the AI assistant and place search need a connection. Saved data is removed when you
          log out.
        </p>
      </div>
    </>
  );
}
