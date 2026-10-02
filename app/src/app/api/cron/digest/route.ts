import { timingSafeEqual } from "node:crypto";
import { buildDigest } from "@/lib/digest";
import { sendMail } from "@/lib/mail";
import { todayStr } from "@/lib/run-agent";
import { listClubs, listStaff } from "@/lib/store";
import { coachToday } from "@/lib/views";

export const dynamic = "force-dynamic";

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // no secret configured: the endpoint stays closed
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

// Called once each morning by the scheduler. Sends each club's coaches one email.
export async function GET(req: Request) {
  if (!authorised(req)) return new Response("Unauthorized", { status: 401 });
  const today = todayStr();
  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  const summary: { club: string; sent: number; failed: number }[] = [];
  for (const club of await listClubs()) {
    const [data, staff] = await Promise.all([coachToday(club.id, today), listStaff(club.id)]);
    if (data.roster.length === 0) continue;
    const { subject, text } = buildDigest({ clubName: club.name, date: today, sessionLabel: data.session?.label ?? null, roster: data.roster, appUrl });
    let sent = 0, failed = 0;
    for (const s of staff.filter((x) => x.roles.includes("coach"))) {
      const r = await sendMail({ to: s.email, subject, text });
      if (r.sent) sent++;
      else failed++;
    }
    summary.push({ club: club.id, sent, failed });
  }
  return Response.json({ date: today, summary });
}
