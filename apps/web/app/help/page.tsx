import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@orbi/core";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: `Help · ${APP_NAME}`,
  description: "How to plan trips with ORBI, use the AI assistant, and run ORBI on your own server.",
};

const GITHUB = "https://github.com/kaizenics/orbi";

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border bg-muted/60 p-4 text-[13px] leading-relaxed">
      <code className="font-mono">{children}</code>
    </pre>
  );
}

const C = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
);

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-l-4 border-foreground/70 bg-muted/50 px-4 py-3 text-sm">{children}</div>
  );
}

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

const GROUPS: { title: string; sections: Section[] }[] = [
  {
    title: "Getting started",
    sections: [
      {
        id: "introduction",
        title: "What ORBI is",
        body: (
          <>
            <p>
              ORBI is a map-first trip planner. You plan each day as a timeline of places and activities, see
              the real routes between them on a map, and get arrival times that add up. An AI assistant can
              draft days, edit them, or turn an itinerary you already have into a trip.
            </p>
            <p>
              It is free and open source (AGPL-3.0). Use the hosted version, or run your own copy: see{" "}
              <a href="#self-host" className="underline">
                Self-hosting
              </a>
              .
            </p>
          </>
        ),
      },
      {
        id: "sign-in",
        title: "Signing in",
        body: (
          <>
            <p>
              Click <strong>Log in</strong> and choose <strong>Continue with Google</strong>. ORBI only
              receives your name, email and profile photo. Every account has its own private trips; nobody
              else can see or open them.
            </p>
            <p>
              Your account menu (your photo, top right) has Settings, this Help page, the app version and{" "}
              <strong>Log out</strong>.
            </p>
          </>
        ),
      },
      {
        id: "first-trip",
        title: "Your first trip",
        body: (
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Open <strong>My Trips</strong> and click <strong>New Trip</strong>.
            </li>
            <li>Give it a name and a region (for example &quot;Cebu, Philippines&quot;).</li>
            <li>
              Pick start and end dates, or leave them empty and set the number of days. Add a budget if you
              want ORBI to track costs.
            </li>
            <li>
              Click <strong>Create trip</strong>. The trip opens with its days ready to fill.
            </li>
          </ol>
        ),
      },
    ],
  },
  {
    title: "Planning",
    sections: [
      {
        id: "my-trips",
        title: "My Trips",
        body: (
          <>
            <p>
              Every trip is a card with a countdown, dates, days, places and budget. Use the search box and
              the <strong>Upcoming / Past / All</strong> filter to find one. The buttons on each card edit,{" "}
              <strong>duplicate</strong> (a full copy with every stop) or delete the trip.
            </p>
            <p>
              On the right, <strong>Timezones</strong> shows live clocks. Click <strong>+</strong> to add up
              to five cities and hover a clock to remove it. <strong>Upcoming trips</strong> lists your next
              trips by date.
            </p>
          </>
        ),
      },
      {
        id: "days",
        title: "Days and the timeline",
        body: (
          <>
            <p>
              Inside a trip, pick a day from the day menu. The day header shows the distance, number of
              places, end time and cost. The sliders button opens the day&apos;s title, start time and travel
              mode (walking or driving).
            </p>
            <p>
              The day is a timeline: numbered dots are places, icons are activities. The time on each card is
              when you arrive. Between places you see the travel distance and time. Drag a dot on the line to
              reorder; times and routes update straight away.
            </p>
            <Note>
              An orange <strong>+ min</strong> chip means you will reach a stop after its fixed time. A
              warning above the timeline tells you if the day runs past your end time or over your daily
              travel limit.
            </Note>
          </>
        ),
      },
      {
        id: "places",
        title: "Adding places",
        body: (
          <>
            <p>
              Use <strong>Add a place</strong> on the right of the trip. Search by name (results near the day
              you are viewing come first), then choose <strong>Add to Day N</strong> or{" "}
              <strong>Save as idea</strong>. Ideas wait in the trip until you schedule them on a day.
            </p>
            <p>
              Click a place card to highlight it on the map. The pencil edits its name, visit length, fixed
              arrival time, category, cost, opening hours and notes, and lets you move it to another day. The
              arrow button opens the place in Google Maps for directions.
            </p>
          </>
        ),
      },
      {
        id: "activities",
        title: "Activities",
        body: (
          <p>
            Activities are moments without a place on the map: wake up, breakfast, lunch, dinner, rest, free
            time, check in or out, transfers. Click <strong>Add activity</strong> under the timeline, pick a
            type (the duration fills in for you) and optionally a label like &quot;at the hotel&quot;.
            Activities take time in the schedule but add no travel.
          </p>
        ),
      },
      {
        id: "map",
        title: "The map",
        body: (
          <p>
            The map shows the selected day&apos;s stops and routes. Use <strong>Satellite</strong> on the map
            to switch to aerial imagery and back. In <strong>Settings → Map</strong> you can make the map
            follow the app theme, or always use light, dark or satellite.
          </p>
        ),
      },
      {
        id: "budget",
        title: "Budget and editing a trip",
        body: (
          <p>
            The trip header shows the estimated total against your budget, and turns red when you go over. The
            pencil next to the trip name opens <strong>Edit trip</strong>: name, region, dates, budget, day
            start and end, pace, daily travel limit, interests and planning notes. Interests and notes also
            guide the AI.
          </p>
        ),
      },
    ],
  },
  {
    title: "AI assistant",
    sections: [
      {
        id: "ai-key",
        title: "Connecting your AI key",
        body: (
          <>
            <p>
              ORBI uses your own AI provider, so you control the cost. Open{" "}
              <strong>Settings → Integrations</strong>, choose a provider (OpenRouter, OpenAI, Anthropic or
              Google), paste your API key and pick a model. The list only shows free and low-cost models.
            </p>
            <Note>
              Your key is saved only in this browser and sent with each AI request. The server never stores
              it. On another browser or device, enter it again. OpenRouter&apos;s free models cost nothing.
            </Note>
          </>
        ),
      },
      {
        id: "ai-drafts",
        title: "Drafting and editing days",
        body: (
          <>
            <p>
              In a trip, the <strong>AI assistant</strong> box takes a request like &quot;historic sights,
              local food and a beach day within ₱10,000&quot;. <strong>Draft days</strong> plans full days in
              time order: wake up, breakfast, sights, lunch, dinner. <strong>Suggest edits</strong> changes
              what you already have, for example &quot;make day 2 less tiring&quot;.
            </p>
            <p>
              You review every suggestion before it is saved: untick anything you don&apos;t want, then apply.
              Every place is checked against map data; places that can&apos;t be found are marked and skipped.
            </p>
          </>
        ),
      },
      {
        id: "ai-chat",
        title: "The chat",
        body: (
          <>
            <p>
              The round button at the bottom right opens the ORBI assistant on every page. Ask travel
              questions, or:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Paste an itinerary</strong> (&quot;Day 1: …, Day 2: …&quot;) and ORBI creates the
                whole trip with every stop on the map.
              </li>
              <li>
                <strong>Edit a trip by name</strong> (&quot;add a seafood lunch to my Cebu weekend&quot;), or
                say &quot;this trip&quot; while one is open. Chat edits apply straight away.
              </li>
            </ul>
            <p>
              Minimize the chat with <strong>–</strong>: a reply keeps running and a small pill shows its
              progress; a dot on the button means a reply is waiting. The conversation is saved in your
              browser until you clear it. The assistant only discusses travel.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: "More",
    sections: [
      {
        id: "settings",
        title: "Settings",
        body: (
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>General:</strong> light, dark or system theme; 24-hour or 12-hour times; kilometres or
              miles.
            </li>
            <li>
              <strong>Map:</strong> map style.
            </li>
            <li>
              <strong>Integrations:</strong> your AI provider and key.
            </li>
            <li>
              <strong>Account:</strong> who you are signed in as, and log out.
            </li>
          </ul>
        ),
      },
      {
        id: "phone",
        title: "Using ORBI on your phone",
        body: (
          <p>
            The web app works on phones: the map sits on top and the plan below. On iPhone, open ORBI in
            Safari, tap <strong>Share → Add to Home Screen</strong>. An Android app is part of the project
            (see{" "}
            <a href="#self-host-android" className="underline">
              Android app
            </a>
            ).
          </p>
        ),
      },
      {
        id: "privacy",
        title: "Privacy and your data",
        body: (
          <p>
            Trips are tied to your Google account and stored in the ORBI database. Your AI key, chat history
            and display settings stay in your browser. Place search and routing use OpenStreetMap services;
            map tiles come from OpenFreeMap and satellite imagery from Esri.
          </p>
        ),
      },
    ],
  },
  {
    title: "Self-hosting",
    sections: [
      {
        id: "self-host",
        title: "Run it on your computer",
        body: (
          <>
            <p>
              You need <strong>Node.js 26</strong> and <strong>pnpm 11</strong>. Then:
            </p>
            <Code>{`git clone ${GITHUB}.git orbi
cd orbi
pnpm install
pnpm dev`}</Code>
            <p>
              Open <C>http://localhost:3000</C>. The API runs inside the web app and keeps data in{" "}
              <C>apps/web/data/orbi.db</C>, created automatically. Sign-in is off on your computer until you
              add Google credentials. Optional demo trip:
            </p>
            <Code>{`ORBI_DATABASE_URL=file:../web/data/orbi.db pnpm --filter @orbi/server db:seed`}</Code>
          </>
        ),
      },
      {
        id: "self-host-deploy",
        title: "Deploy for free (Vercel + Turso)",
        body: (
          <>
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                <strong>Database:</strong> create a free database at{" "}
                <a href="https://turso.tech" className="underline">
                  turso.tech
                </a>
                , copy its URL and a token, and create the tables:
                <div className="mt-2">
                  <Code>{`ORBI_DATABASE_URL=libsql://<db>.turso.io ORBI_DATABASE_AUTH_TOKEN=<token> \\
  pnpm --filter @orbi/db db:migrate`}</Code>
                </div>
              </li>
              <li>
                <strong>Google sign-in:</strong> in Google Cloud Console create an OAuth client (Web
                application) and add <C>https://&lt;your-domain&gt;/auth/google/callback</C> as an authorized
                redirect URI. Publish the consent screen so any Google account can sign in.
              </li>
              <li>
                <strong>Vercel:</strong> import the repository, choose the <C>web</C> app (root directory{" "}
                <C>apps/web</C>), add the variables below and deploy.
              </li>
            </ol>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-4 py-2 font-medium">Variable</th>
                    <th className="px-4 py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["ORBI_DATABASE_URL", "Your Turso URL"],
                    ["ORBI_DATABASE_AUTH_TOKEN", "Your Turso token"],
                    ["GOOGLE_CLIENT_ID", "From Google Cloud"],
                    ["GOOGLE_CLIENT_SECRET", "From Google Cloud"],
                    ["GEO_CONTACT_EMAIL", "Your email (asked for by the free place-search service)"],
                    ["ORBI_API_TOKEN", "Optional: a random secret, only for the Android app"],
                  ].map(([name, value]) => (
                    <tr key={name}>
                      <td className="px-4 py-2 font-mono text-[13px]">{name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note>
              When you update ORBI later and a new database migration is included, run the <C>db:migrate</C>{" "}
              command again before deploying.
            </Note>
          </>
        ),
      },
      {
        id: "self-host-docker",
        title: "Your own server (Docker)",
        body: (
          <>
            <p>
              To run the API on a server or VM instead, use the included Docker setup (Caddy provides HTTPS):
            </p>
            <Code>{`cp infra/.env.example infra/.env   # set ORBI_DOMAIN, ORBI_API_TOKEN
docker compose -f infra/docker-compose.yml up -d --build`}</Code>
            <p>
              Then set <C>ORBI_API_URL=https://&lt;server-domain&gt;</C> and the same <C>ORBI_API_TOKEN</C> in
              the web app so it forwards API calls to your server. Maps, search and routing can also point at
              your own OpenFreeMap, Nominatim/Photon and OSRM instances.
            </p>
          </>
        ),
      },
      {
        id: "self-host-android",
        title: "Android app",
        body: (
          <>
            <p>
              The Android app needs Android Studio and a development build. Point it at your server in{" "}
              <C>apps/mobile/.env</C>, then build:
            </p>
            <Code>{`EXPO_PUBLIC_API_URL=https://<your-domain>/api
EXPO_PUBLIC_API_TOKEN=<ORBI_API_TOKEN>

pnpm --filter mobile android`}</Code>
          </>
        ),
      },
      {
        id: "faq",
        title: "Troubleshooting",
        body: (
          <dl className="space-y-4">
            {[
              [
                '"Continue with Google" shows a redirect error',
                "Add your site's /auth/google/callback address to the OAuth client's authorized redirect URIs.",
              ],
              [
                "Only some Google accounts can sign in",
                "Your OAuth consent screen is in testing mode. Publish it in Google Cloud Console.",
              ],
              [
                "Trips fail to load after an update",
                "The database needs the latest migrations. Run the db:migrate command against your database.",
              ],
              [
                "The AI says the key was rejected",
                "Check the key in Settings → Integrations, and that the chosen model is available to it.",
              ],
              [
                "A place can't be found",
                "Try the official name plus the city, or add it with the map search and keep the AI suggestion's details.",
              ],
            ].map(([q, a]) => (
              <div key={q}>
                <dt className="font-medium">{q}</dt>
                <dd className="mt-1 text-muted-foreground">{a}</dd>
              </div>
            ))}
          </dl>
        ),
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" aria-label={`${APP_NAME} home`} className="flex items-center gap-3">
            <Logo className="text-lg" />
            <span className="text-muted-foreground">Docs</span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <a href={GITHUB} className="text-muted-foreground hover:text-foreground">
              GitHub
            </a>
            <Link
              href="/trips"
              className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground"
            >
              Open planner
            </Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-10 px-6 py-10 lg:grid-cols-[220px_1fr] lg:py-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="Guide" className="flex flex-col gap-6 text-sm">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-2 font-heading font-semibold">{group.title}</p>
                <ul className="flex flex-col gap-1.5 border-l">
                  {group.sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="-ml-px block border-l border-transparent pl-3 text-muted-foreground hover:border-foreground hover:text-foreground"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="max-w-3xl min-w-0">
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">ORBI guide</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Everything you need to plan trips with ORBI, and to run your own copy.
          </p>
          {GROUPS.map((group) => (
            <div key={group.title} className="mt-14">
              <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {group.title}
              </p>
              {group.sections.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-24 border-b py-8 last:border-b-0">
                  <h2 className="font-heading text-2xl font-bold tracking-tight">
                    <a href={`#${s.id}`} className="hover:underline">
                      {s.title}
                    </a>
                  </h2>
                  <div className="mt-4 space-y-4 leading-relaxed text-foreground/90">{s.body}</div>
                </section>
              ))}
            </div>
          ))}
        </main>
      </div>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground md:flex-row md:justify-between">
          <span>Something missing? Open an issue on GitHub.</span>
          <a href={`${GITHUB}/issues`} className="underline hover:text-foreground">
            Report an issue
          </a>
        </div>
      </footer>
    </div>
  );
}
