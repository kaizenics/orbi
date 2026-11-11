import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { APP_NAME } from "@orbi/core";
import {
  HeroLines,
  HeroVisual,
  PhotoBand,
  Reveal,
  Shot,
  StackCards,
  type StackItem,
} from "@/components/landing/motion";
import { StarCta } from "@/components/landing/star-cta";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { currentEmail } from "@/lib/session";

const GITHUB = "https://github.com/kaizenics/orbi";

/** The assistant panel as real markup (Tokyo copy), so it stays sharp and follows the theme. */
function ChatPreview() {
  return (
    <div
      role="img"
      aria-label="ORBI assistant moving Ueno Park to day 2 and adding a ramen lunch near Senso-ji"
      className="absolute inset-0 flex flex-col bg-card text-card-foreground"
    >
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <span className="grid size-10 place-items-center rounded-full bg-foreground text-background">
          <MapPin aria-hidden className="size-5" />
        </span>
        <div>
          <p className="font-semibold">ORBI assistant</p>
          <p className="text-sm text-muted-foreground">Ask, paste an itinerary, or edit a trip</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-6">
        <p className="ml-auto max-w-[80%] rounded-2xl bg-foreground px-4 py-3 text-background">
          Make day 1 less tiring and add a ramen lunch near Senso-ji
        </p>
        <div className="max-w-[85%] rounded-2xl bg-muted p-4">
          <p>
            Updated <strong>Tokyo weekend</strong> (2 changes).
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Moved Ueno Park to day 2 and added lunch at Ichiran Asakusa, a short walk from Senso-ji.
          </p>
          <span className="mt-3 inline-flex rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background">
            Open trip
          </span>
        </div>
      </div>
    </div>
  );
}

const FEATURES: StackItem[] = [
  {
    title: "Every stop on the map",
    body: "Real road and walking routes between stops, in map or satellite view.",
    visual: (
      <Shot
        name="tokyo-satellite"
        alt="Satellite view of Asakusa, Tokyo with a day's driving route and four numbered stops"
        sizes="(min-width: 768px) 60vw, 100vw"
        className="object-cover object-center"
      />
    ),
    tone: "dark",
  },
  {
    title: "A schedule that adds up",
    body: "Wake up to dinner, with arrival times worked out from every visit and drive.",
    visual: (
      <Shot
        name="tokyo-timeline"
        alt="Day 1 in Tokyo: Senso-ji at 09:00, then Ichiran Asakusa at 10:01, with drive times between"
        sizes="(min-width: 768px) 60vw, 100vw"
        className="object-cover object-top"
      />
    ),
    tone: "light",
  },
  {
    title: "Plan by chatting",
    body: "Ask, paste an itinerary, or say what to change. Uses your own AI key.",
    visual: <ChatPreview />,
    tone: "light",
  },
  {
    title: "All your trips, at a glance",
    body: "Countdowns, budgets and clocks for every place you are heading. Private to your account.",
    visual: (
      <Shot
        name="tokyo-dashboard"
        alt="My Trips dashboard with the Tokyo weekend card, a Tokyo clock and upcoming trips"
        sizes="(min-width: 768px) 60vw, 100vw"
        className="object-cover object-left-top"
      />
    ),
    tone: "light",
  },
];

const STEPS = [
  { title: "Create a trip", body: "Set the dates, the region and a budget. Days appear ready to fill." },
  {
    title: "Draft it with AI or by hand",
    body: "Describe the trip, paste an itinerary you already have, or search places yourself.",
  },
  {
    title: "Shape each day",
    body: "Drag stops, add meals and rests, fix a time. Routes and arrival times follow.",
  },
  { title: "Go", body: "Open the plan on your phone and hand each stop to your maps app for directions." },
];

/** White button (in both themes) for the repository. */
function GithubButton() {
  return (
    <a
      href={GITHUB}
      className="inline-flex h-12 items-center gap-2 rounded-full border border-zinc-200 bg-white px-7 text-base font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-100 active:scale-[0.98]"
    >
      View on GitHub <ArrowUpRight aria-hidden className="size-4" />
    </a>
  );
}

export default async function LandingPage() {
  const signedIn = (await currentEmail()) !== null;
  const cta = signedIn ? "Open planner" : "Start planning";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-transparent bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" aria-label={`${APP_NAME} home`}>
            <Logo className="text-lg" />
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <a href="#features" className="hidden text-muted-foreground hover:text-foreground md:inline">
              Features
            </a>
            <a href="#how-it-works" className="hidden text-muted-foreground hover:text-foreground md:inline">
              How it works
            </a>
            <Link href="/help" className="hidden text-muted-foreground hover:text-foreground md:inline">
              Docs
            </Link>
            <a href={GITHUB} className="hidden text-muted-foreground hover:text-foreground md:inline">
              GitHub
            </a>
            {signedIn ? (
              <UserMenu />
            ) : (
              <Link href="/login" className="font-medium hover:opacity-70">
                Log in
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-16 px-6 pt-10 pb-24 lg:grid-cols-[5fr_7fr] lg:pt-16">
          <div className="flex flex-col items-start gap-7">
            <HeroLines
              lines={["Plan every day", "on a real map."]}
              className="font-heading text-5xl leading-[1.02] font-extrabold tracking-tight text-balance md:text-6xl xl:text-7xl"
            />
            <Reveal delay={0.35}>
              <p className="max-w-[42ch] text-lg leading-relaxed text-muted-foreground">
                Routes, travel times and a schedule that adds up. Let AI draft the days, then make them yours.
              </p>
            </Reveal>
            <Reveal delay={0.5} className="flex flex-wrap items-center gap-3">
              <StarCta href="/trips">{cta}</StarCta>
              <GithubButton />
            </Reveal>
          </div>

          <HeroVisual
            desktop={
              <Shot
                name="tokyo-planner-desktop"
                alt="ORBI on desktop: a day in Tokyo as a timeline beside its driving route on a map"
                width={1440}
                height={900}
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="h-auto w-full"
              />
            }
            mobile={
              <Shot
                name="tokyo-planner-mobile"
                alt="ORBI on a phone: the same day with the map on top and the plan below"
                width={390}
                height={844}
                sizes="220px"
                className="h-auto w-full"
              />
            }
          />
        </section>

        <section
          id="features"
          aria-labelledby="features-heading"
          className="mx-auto max-w-7xl px-6 py-24 lg:py-32"
        >
          <Reveal>
            <h2
              id="features-heading"
              className="max-w-3xl font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl"
            >
              Everything a day plan needs. Nothing it doesn&apos;t.
            </h2>
          </Reveal>

          <div className="mt-14">
            <StackCards items={FEATURES} />
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-heading" className="border-t">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[2fr_3fr] lg:py-32">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Reveal>
                <h2 id="how-heading" className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
                  From idea to itinerary in minutes.
                </h2>
              </Reveal>
            </div>
            <ol className="flex flex-col">
              {STEPS.map((step, i) => (
                <li key={step.title} className="border-t py-8 first:border-t-0 first:pt-0">
                  <Reveal delay={i * 0.05} className="grid gap-2 md:grid-cols-[3rem_1fr]">
                    <span aria-hidden className="font-heading text-lg font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-heading text-2xl font-bold tracking-tight">{step.title}</h3>
                      <p className="mt-2 max-w-[52ch] text-muted-foreground">{step.body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <PhotoBand
          src="https://picsum.photos/id/1015/2400/1400"
          alt="A river winding through a mountain valley"
        >
          <div className="mx-auto w-full max-w-7xl px-6 pb-20 text-white">
            <Reveal>
              <p className="max-w-3xl font-heading text-4xl font-bold tracking-tight text-balance md:text-6xl">
                Spend the trip exploring, not in a spreadsheet.
              </p>
            </Reveal>
          </div>
        </PhotoBand>

        <section aria-labelledby="oss-heading" className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
          <Reveal className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h2 id="oss-heading" className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
                Free and open source.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Built on OpenStreetMap and open routing. No subscription, and your trips stay in your account.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <StarCta href="/trips">{cta}</StarCta>
              <GithubButton />
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <Logo className="text-base text-foreground" mark="size-5" />
          <p>
            Map data ©{" "}
            <a href="https://www.openstreetmap.org/copyright" className="underline hover:text-foreground">
              OpenStreetMap contributors
            </a>
            . Licensed AGPL-3.0.
          </p>
        </div>
      </footer>
    </div>
  );
}
