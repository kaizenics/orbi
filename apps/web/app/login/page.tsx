import { APP_NAME, APP_TAGLINE } from "@orbi/core";
import { safeNextPath } from "@/lib/session";
import { inputClass, labelClass, primaryButton } from "@/lib/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form
        method="post"
        action="/auth/login"
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border bg-card p-6"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="text-sm text-muted-foreground">{APP_TAGLINE}</p>
        </div>
        <input type="hidden" name="next" value={safeNextPath(next)} />
        <label className={labelClass}>
          Password
          <input
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            Wrong password.
          </p>
        ) : null}
        <button type="submit" className={primaryButton}>
          Log in
        </button>
      </form>
    </main>
  );
}
