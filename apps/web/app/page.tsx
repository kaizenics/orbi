import Image from "next/image";
import Link from "next/link";
import {
  CalendarClock,
  ExternalLink,
  Map as MapIcon,
  Route,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@orbi/core";
import { UserMenu } from "@/components/user-menu";
import { currentEmail } from "@/lib/session";

const FEATURES = [
  {
    icon: MapIcon,
    title: "Every stop on the map",
    body: "Numbered markers per day, connected by real road and walking routes, with distance and travel time for each leg.",
  },
  {
    icon: CalendarClock,
    title: "A schedule that adds up",
    body: "Arrival and departure times follow from visit lengths, travel and fixed reservations. ORBI warns when a day runs late.",
  },
  {
    icon: Sparkles,
    title: "AI that proposes, you decide",
    body: "Describe the trip and get a draft, or ask for changes. Every place is checked against map data, and nothing is saved until you apply it.",
  },
  {
    icon: Route,
    title: "Reorder in seconds",
    body: "Drag stops or use the keyboard. Routes, numbering and times update straight away.",
  },
  {
    icon: Wallet,
    title: "Budget in view",
    body: "Estimated costs per stop and per day, compared with your trip budget.",
  },
  {
    icon: ShieldCheck,
    title: "Yours to run",
    body: "Open source under AGPL-3.0. Self-host it, keep your data, and run it on free tiers.",
  },
];

const STEPS = [
  { title: "Create a trip", body: "Set the dates, region and budget." },
  { title: "Describe it or add places", body: "Let AI draft the days, or search and add places yourself." },
  { title: "Shape the days", body: "Reorder, set fixed times and see routes and times update." },
  {
    title: "Take it with you",
    body: "Open the plan on your phone and hand off to your maps app for directions.",
  },
];

export default async function LandingPage() {
  const signedIn = (await currentEmail()) !== null;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <a href="#features" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              Features
            </a>
            <a href="#open-source" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              Open source
            </a>
            {signedIn ? (
              <>
                <Link
                  href="/trips"
                  className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
                >
                  Open planner
                </Link>
                <UserMenu />
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
              >
                Log in
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 pt-20 pb-12 text-center">
          <p className="rounded-full border px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Map-first trip planner
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            {APP_TAGLINE}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
            Plan each day on a real map, see how long the travel takes, and let AI draft the itinerary for you
            to review. Free, open source, and built to run on your own server.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/trips"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Start planning
            </Link>
            <a
              href="#how-it-works"
              className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-muted"
            >
              How it works
            </a>
          </div>
        </section>

        <section aria-label="Product preview" className="mx-auto max-w-6xl px-6 pb-24">
          <div className="overflow-hidden rounded-xl border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <Image
              src="/landing/planner.png"
              alt="ORBI planner showing a day in Cebu: six numbered stops with arrival times on the left and their walking route on a city map on the right"
              width={1440}
              height={900}
              priority
              className="h-auto w-full"
            />
          </div>
        </section>

        <section id="features" aria-labelledby="features-heading" className="border-t bg-card">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 id="features-heading" className="max-w-2xl text-3xl font-semibold tracking-tight">
              Everything a day plan needs, on one screen
            </h2>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex flex-col gap-3 bg-card p-8">
                  <Icon aria-hidden className="size-5 text-accent-foreground" />
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-6xl px-6 py-24">
          <h2 id="how-heading" className="text-3xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span className="font-mono text-sm text-muted-foreground">0{i + 1}</span>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="open-source" aria-labelledby="oss-heading" className="border-t bg-card">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-24 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 id="oss-heading" className="text-3xl font-semibold tracking-tight">
                Open source, no subscription
              </h2>
              <p className="mt-4 text-muted-foreground">
                ORBI uses OpenStreetMap data and open routing, and works with free AI models. Run it on free
                tiers or your own hardware; your trips stay in your database.
              </p>
            </div>
            <a
              href="https://github.com/kaizenics/orbi"
              className="inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-muted"
            >
              <ExternalLink aria-hidden className="size-4" /> View on GitHub
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span>{APP_NAME} · AGPL-3.0-or-later</span>
          <span>
            Map data ©{" "}
            <a href="https://www.openstreetmap.org/copyright" className="underline">
              OpenStreetMap contributors
            </a>
            {" · "}Tiles by OpenFreeMap
          </span>
        </div>
      </footer>
    </div>
  );
}
