"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setPreference, usePreferences, type Preferences } from "@/lib/preferences";
import { setTheme, useThemeChoice, type ThemeChoice } from "@/lib/theme";

/** A titled card holding setting rows. */
export function SettingsCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-2xl border bg-card">
      <h2 className="flex items-center gap-3 border-b bg-muted/60 px-4 py-3 font-semibold">
        <span className="inline-flex size-8 items-center justify-center rounded-lg border bg-card [&>svg]:size-4">
          {icon}
        </span>
        {title}
      </h2>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  );
}

/** One setting: label and description on the left, the control on the right. */
export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

/** Two or three mutually exclusive options (shadcn ToggleGroup). */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label={label}
      value={value}
      // Radix sends "" when the active item is clicked again; keep the current choice.
      onValueChange={(v) => v && onChange(v as T)}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="px-3">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function GeneralSettings() {
  const theme = useThemeChoice();
  const prefs = usePreferences();
  return (
    <>
      <SettingRow label="Appearance" description="Light, dark, or follow your device.">
        <Segmented<ThemeChoice>
          label="Appearance"
          value={theme}
          onChange={setTheme}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
      </SettingRow>
      <SettingRow label="Time format" description="How stop and day times are shown.">
        <Segmented<Preferences["timeFormat"]>
          label="Time format"
          value={prefs.timeFormat}
          onChange={(v) => setPreference("timeFormat", v)}
          options={[
            { value: "24h", label: "24h (14:30)" },
            { value: "12h", label: "12h (2:30 PM)" },
          ]}
        />
      </SettingRow>
      <SettingRow label="Distance unit" description="Used for travel between stops and day totals.">
        <Segmented<Preferences["distanceUnit"]>
          label="Distance unit"
          value={prefs.distanceUnit}
          onChange={(v) => setPreference("distanceUnit", v)}
          options={[
            { value: "metric", label: "km Metric" },
            { value: "imperial", label: "mi Imperial" },
          ]}
        />
      </SettingRow>
    </>
  );
}

export function MapSettings() {
  const prefs = usePreferences();
  return (
    <SettingRow
      label="Map style"
      description="Follow the app's light or dark mode, keep one style, or show satellite imagery."
    >
      <Segmented<Preferences["mapStyle"]>
        label="Map style"
        value={prefs.mapStyle}
        onChange={(v) => setPreference("mapStyle", v)}
        options={[
          { value: "auto", label: "Match app" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "satellite", label: "Satellite" },
        ]}
      />
    </SettingRow>
  );
}
