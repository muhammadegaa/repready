import { timingSafeEqual } from "node:crypto";
import { syncCalendar } from "@/lib/calendar-sync";
import { listCalendarClubs } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

// Each morning, every club with a calendar link gets its match dates read again.
export async function GET(req: Request) {
  if (!authorised(req)) return new Response("Unauthorized", { status: 401 });
  const results: { club: string; ok: boolean }[] = [];
  for (const club of await listCalendarClubs()) results.push({ club, ok: (await syncCalendar(club)).ok });
  return Response.json({ results });
}
