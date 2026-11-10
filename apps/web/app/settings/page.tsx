import Link from "next/link";
import { Bell, CloudOff, Map, Plug, Settings, SlidersHorizontal, User } from "lucide-react";
import { AiSettingsForm } from "@/components/ai-settings-form";
import { TopBar } from "@/components/planner-shell";
import { GeneralSettings, MapSettings, SettingRow, SettingsCard } from "@/components/settings-panels";
import { authConfig, currentUser } from "@/lib/session";
import { Avatar } from "@/components/avatar";
import { LogoutForm } from "@/components/logout-form";
import { OfflineSettings } from "@/components/offline-settings";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  { id: "general", label: "General", icon: <SlidersHorizontal /> },
  { id: "map", label: "Map", icon: <Map /> },
  { id: "notifications", label: "Notifications", icon: <Bell /> },
  { id: "integrations", label: "Integrations", icon: <Plug /> },
  { id: "offline", label: "Offline", icon: <CloudOff /> },
  { id: "account", label: "Account", icon: <User /> },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = SECTIONS.find((s) => s.id === tab) ?? SECTIONS[0];

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
        <header className="flex items-center gap-3 rounded-2xl border bg-muted/60 px-4 py-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl border bg-card">
            <Settings aria-hidden className="size-4" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure your personal settings</p>
          </div>
        </header>

        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <nav aria-label="Settings sections" className="rounded-2xl border bg-card p-2 md:w-60 md:shrink-0">
            <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Settings
            </p>
            <ul className="flex gap-1 overflow-x-auto md:flex-col">
              {SECTIONS.map((s) => (
                <li key={s.id} className="shrink-0">
                  <Link
                    href={`/settings?tab=${s.id}`}
                    aria-current={s.id === active.id ? "page" : undefined}
                    className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-sm hover:bg-muted aria-[current=page]:border-border aria-[current=page]:bg-background aria-[current=page]:font-medium [&_svg]:size-4"
                  >
                    <span className="inline-flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {s.icon}
                    </span>
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <SettingsCard icon={active.icon} title={active.label}>
              <Section id={active.id} />
            </SettingsCard>
          </div>
        </div>
      </main>
    </div>
  );
}

async function Section({ id }: { id: SectionId }) {
  switch (id) {
    case "general":
      return <GeneralSettings />;
    case "map":
      return <MapSettings />;
    case "integrations":
      return <AiSettingsForm />;
    case "notifications":
      return (
        <SettingRow
          label="No notifications yet"
          description="ORBI doesn't send emails or push notifications. Trip reminders will appear here when they're available."
        />
      );
    case "offline":
      return <OfflineSettings />;
    case "account":
      return <AccountSettings />;
  }
}

async function AccountSettings() {
  const auth = authConfig();
  if (!auth) {
    return (
      <SettingRow
        label="Sign-in is off"
        description="This server runs without Google sign-in, so everyone shares one local workspace."
      />
    );
  }
  const user = await currentUser();
  return (
    <>
      <SettingRow
        label={user?.name ?? "Signed in with Google"}
        description={user?.email ?? "Unknown account"}
      >
        <Avatar name={user?.name ?? user?.email ?? "?"} picture={user?.picture ?? null} className="size-10" />
      </SettingRow>
      <SettingRow
        label="Your trips"
        description="Trips are private to this account. Nobody else can see them."
      >
        <LogoutForm>
          <Button variant="outline" type="submit">
            Log out
          </Button>
        </LogoutForm>
      </SettingRow>
    </>
  );
}
