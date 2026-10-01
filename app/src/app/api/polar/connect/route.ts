import { NextResponse } from "next/server";
import { authorizeUrl, newNonce, polarEnabled } from "@/lib/polar";
import { getAthlete } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const athlete = polarEnabled() ? await getAthlete(code) : null;
  if (!athlete?.consented_at) return NextResponse.redirect(new URL(athlete ? `/a/${code}` : "/", url.origin));
  const nonce = newNonce();
  const res = NextResponse.redirect(authorizeUrl(code, nonce, url.origin));
  res.cookies.set("polar_nonce", nonce, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/polar", maxAge: 900 });
  return res;
}
