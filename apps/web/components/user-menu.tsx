"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, CircleHelp, LogOut, Settings } from "lucide-react";
import { APP_NAME } from "@orbi/core";
import { Avatar } from "@/components/avatar";
import { LogoutForm } from "@/components/logout-form";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

/** Avatar button with the account menu: settings, help, log out and the app version. */
export function UserMenu() {
  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () =>
      (await (await fetch("/auth/me")).json()) as {
        email: string | null;
        name: string | null;
        picture: string | null;
        signInEnabled: boolean;
      },
    staleTime: Infinity,
  });
  const email = me.data?.email ?? null;
  // The Google profile name; older sessions (before the profile scope) fall back to the email.
  const name = me.data?.name ?? (email ? email.split("@")[0]! : "Guest");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label="Account menu" className="h-10 gap-2 rounded-full pr-2 pl-1">
          <Avatar name={name} picture={me.data?.picture ?? null} />
          <span className="hidden max-w-40 truncate sm:inline">{name}</span>
          <ChevronDown aria-hidden className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {email ?? (me.data?.signInEnabled ? "Not signed in" : "Local workspace")}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help">
            <CircleHelp aria-hidden /> Help
          </Link>
        </DropdownMenuItem>
        {email ? (
          <>
            <DropdownMenuSeparator />
            <LogoutForm>
              <DropdownMenuItem variant="destructive" asChild>
                <button type="submit" className="w-full">
                  <LogOut aria-hidden /> Log out
                </button>
              </DropdownMenuItem>
            </LogoutForm>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <p className="flex justify-center py-1.5">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {APP_NAME} {VERSION ? `v${VERSION}` : ""}
          </span>
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
