import Link from "next/link";
import { Reveal } from "@/components/landing/motion";
import { redirect } from "next/navigation";
import { APP_NAME, APP_TAGLINE } from "@orbi/core";
import { authConfig, currentEmail, safeNextPath } from "@/lib/session";
import { Logo } from "@/components/logo";

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled.",
  state: "Sign-in expired or was started elsewhere. Please try again.",
  exchange: "Google sign-in failed. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { next, error } = await searchParams;
  const enabled = authConfig() !== null;
  // Already signed in: skip the sign-in screen.
  if (await currentEmail()) redirect(safeNextPath(next));
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Link href="/" aria-label={`${APP_NAME} home`} className="self-start">
          <Logo className="text-lg" />
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-16">
          <Reveal className="flex flex-col gap-3">
            <h1 className="font-heading text-4xl font-bold tracking-tight">Welcome to {APP_NAME}</h1>
            <p className="text-muted-foreground">
              Sign in to plan your trips. They stay private to your account.
            </p>
          </Reveal>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 px-4 py-3 text-sm text-destructive"
            >
              {ERRORS[error] ?? ERRORS.exchange}
            </p>
          ) : null}

          <Reveal delay={0.1} className="flex flex-col gap-4">
            {enabled ? (
              <a
                href={`/auth/google?next=${encodeURIComponent(safeNextPath(next))}`}
                className="inline-flex h-12 items-center justify-center gap-3 rounded-full border bg-card font-medium shadow-sm transition hover:bg-muted active:scale-[0.98]"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="size-5">
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"
                  />
                  <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
                  <path
                    fill="#EA4335"
                    d="M12 4.8c1.7 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"
                  />
                </svg>
                Continue with Google
              </a>
            ) : (
              <p className="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
                Sign-in is not configured on this server (set{" "}
                <code className="font-mono">GOOGLE_CLIENT_ID</code> and{" "}
                <code className="font-mono">GOOGLE_CLIENT_SECRET</code>).{" "}
                <Link href="/trips" className="underline">
                  Continue without signing in
                </Link>
              </p>
            )}
            <p className="text-center text-xs text-muted-foreground">
              ORBI only receives your name, email and profile photo from Google.
            </p>
          </Reveal>
        </div>

        <p className="text-xs text-muted-foreground">
          New here?{" "}
          <Link href="/help" className="underline hover:text-foreground">
            Read the guide
          </Link>
        </p>
      </section>

      <aside aria-hidden className="relative hidden overflow-hidden bg-zinc-950 lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative photo */}
        <img
          src="https://picsum.photos/id/1018/1600/2000"
          alt=""
          className="absolute inset-0 size-full object-cover grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-14 text-white">
          <Reveal delay={0.2}>
            <p className="max-w-md font-heading text-4xl leading-tight font-bold tracking-tight text-balance">
              {APP_TAGLINE}
            </p>
            <p className="mt-4 max-w-sm text-white/70">
              Real routes, arrival times that add up, and an assistant that drafts the days for you.
            </p>
          </Reveal>
        </div>
      </aside>
    </main>
  );
}
