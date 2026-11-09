import { NextResponse } from "next/server";
import { authConfig, currentUser } from "@/lib/session";

/** The signed-in account for the avatar menu: `{ email, name, picture }`, all null when signed out. */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json(
    {
      email: user?.email ?? null,
      name: user?.name ?? null,
      picture: user?.picture ?? null,
      signInEnabled: authConfig() !== null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
