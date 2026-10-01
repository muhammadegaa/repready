import { NextResponse } from "next/server";
import { saveReadiness } from "@/lib/store";
import { fromJunctionSleep, verifyJunction } from "@/lib/wearables";

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyJunction(raw, req.headers)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const parsed = fromJunctionSleep(body);
  if (!parsed) return NextResponse.json({ ok: true, ignored: true });
  await saveReadiness(parsed.athleteCode, parsed.date, parsed.readiness);
  return NextResponse.json({ ok: true });
}
