import { APP_NAME } from "@orbi/core";
import { cn } from "@/lib/utils";

/** ORBI mark (same shape as app/icon.svg) in the text colour, so it follows light/dark mode. */
export function Logo({ className, mark = "size-6" }: { className?: string; mark?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 font-heading font-extrabold tracking-tight", className)}
    >
      <svg viewBox="0 0 100 100" aria-hidden className={mark} fill="currentColor">
        <path
          fillRule="evenodd"
          d="M44 20a34 34 0 1 1 0 68a34 34 0 0 1 0-68zm0 19a15 15 0 1 0 0 30a15 15 0 0 0 0-30z"
        />
        <circle cx="84" cy="16" r="11" />
      </svg>
      {APP_NAME}
    </span>
  );
}
