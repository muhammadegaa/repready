import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, polarEnabled, registerUser, syncPolar, verifyState } from "@/lib/polar";
import { getAthlete, savePolarLink } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (code: string, result: string) => NextResponse.redirect(new URL(`/a/${code}?polar=${result}`, url.origin));
  if (!polarEnabled()) return NextResponse.redirect(new URL("/", url.origin));

  const nonce = (await cookies()).get("polar_nonce")?.value;
  const athleteCode = verifyState(url.searchParams.get("state") ?? "", nonce);
  if (!athleteCode || !(await getAthlete(athleteCode))) return NextResponse.redirect(new URL("/", url.origin));

  const authCode = url.searchParams.get("code");
  if (url.searchParams.get("error") || !authCode) return back(athleteCode, "denied");
  try {
    const token = await exchangeCode(authCode, url.origin);
    await registerUser(token.access_token, athleteCode);
    await savePolarLink(athleteCode, { access_token: token.access_token, polar_user_id: token.x_user_id, connected_at: new Date().toISOString(), last_synced_at: null, error: null });
    await syncPolar(athleteCode);
    const res = back(athleteCode, "connected");
    res.cookies.delete({ name: "polar_nonce", path: "/api/polar" });
    return res;
  } catch {
    return back(athleteCode, "error");
  }
}
