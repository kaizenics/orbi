import Link from "next/link";
import { Bell, CloudOff, Map, Plug, SlidersHorizontal, User } from "lucide-react";
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
      <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 lg:px-8 lg:pt-14">
        <header className="mb-8 lg:mb-12">
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            How ORBI looks, measures and connects for your account.
          </p>
        </header>

        <div className="grid gap-8 md:grid-cols-[13rem_1fr] md:gap-12">
          <nav aria-label="Settings sections" className="md:sticky md:top-20 md:self-start">
            <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
              {SECTIONS.map((s) => (
                <li key={s.id} className="shrink-0">
                  <Link
                    href={`/settings?tab=${s.id}`}
                    aria-current={s.id === active.id ? "page" : undefined}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground [&_svg]:size-4"
                  >
                    {s.icon}
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
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
