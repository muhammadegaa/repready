import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { clubOf, getPulse, type PulseScope } from "@/lib/store";

export const dynamic = "force-dynamic";

// Returns only a timestamp. The coach and science scopes need a signed-in staff member of that role; a player scope needs the player's link code.
export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") ?? "";
  let club: string | null = null;
  if (scope === "coach" || scope === "science") {
    const s = await getSession();
    if (s?.roles.includes(scope === "coach" ? "coach" : "scientist")) club = s.club;
  } else if (/^a_[0-9a-f]{16}$/.test(scope)) {
    club = clubOf(scope.slice(2));
  }
  if (!club) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ at: await getPulse(club, scope as PulseScope) }, { headers: { "Cache-Control": "no-store" } });
}
