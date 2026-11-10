import Link from "next/link";
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
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-lg border bg-card p-6">
        <div>
          <Link href="/" className="text-2xl font-semibold tracking-tight">
            <Logo />
          </Link>
          <p className="text-sm text-muted-foreground">{APP_TAGLINE}</p>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {ERRORS[error] ?? ERRORS.exchange}
          </p>
        ) : null}
        {enabled ? (
          <a
            href={`/auth/google?next=${encodeURIComponent(safeNextPath(next))}`}
            className="inline-flex items-center justify-center gap-2 rounded-md border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-4">
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
          <p className="text-sm text-muted-foreground">
            Sign-in is not configured on this server (set <code className="font-mono">GOOGLE_CLIENT_ID</code>,{" "}
            <code className="font-mono">GOOGLE_CLIENT_SECRET</code>).{" "}
            <Link href="/trips" className="underline">
              Continue without signing in
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
