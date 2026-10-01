import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth";
import { getPulse, type PulseScope } from "@/lib/store";

export const dynamic = "force-dynamic";

// Returns only a timestamp. The coach and scientist scopes need that role; an athlete scope needs the athlete's link code.
export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") ?? "";
  let ok = false;
  if (scope === "coach") ok = (await getRole()) === "coach";
  else if (scope === "science") ok = (await getRole()) === "scientist";
  else ok = /^a_[0-9a-f]{10}$/.test(scope);
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ at: await getPulse(scope as PulseScope) }, { headers: { "Cache-Control": "no-store" } });
}
