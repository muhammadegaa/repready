import { cookies, headers } from "next/headers";
import * as oidc from "openid-client";

// Staff sign in with signo (usesigno.co.uk): a passkey, or a code signo emails them. RepReady keeps no passwords.
// signo speaks OpenID Connect, and RepReady is registered there as a site with a server, so it has a client secret.

export type Intent = { kind: "signin" } | { kind: "signup"; club: string; name: string } | { kind: "join"; token: string; name: string };
type Pending = { state: string; nonce: string; verifier: string; intent: Intent };

const PENDING = "rr_signo";
const CALLBACK = "/auth/callback";

let configuration: Promise<oidc.Configuration> | undefined;
function signo() {
  const issuer = new URL(process.env.SIGNO_ISSUER ?? "https://usesigno.co.uk");
  const id = process.env.SIGNO_CLIENT_ID;
  const secret = process.env.SIGNO_CLIENT_SECRET;
  if (!id || !secret) throw new Error("SIGNO_CLIENT_ID and SIGNO_CLIENT_SECRET are not set");
  // Plain http only for a signo on this machine, in development and tests.
  const local = issuer.protocol === "http:" && ["localhost", "127.0.0.1"].includes(issuer.hostname);
  return (configuration ??= oidc.discovery(issuer, id, undefined, oidc.ClientSecretBasic(secret), { timeout: 10, ...(local ? { execute: [oidc.allowInsecureRequests] } : {}) })
    .catch((error) => {
      configuration = undefined; // so the next sign-in asks signo again
      throw error;
    }));
}

// The address the person is using, which signo sends them back to: the waiting cookie belongs to it. Each address
// staff use must be a callback URL at signo.
async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

// Where to send the person to sign in. What they were doing waits in a cookie for ten minutes, with the values that
// tie signo's answer to this browser; only the callback can read it.
export async function startSigno(intent: Intent): Promise<string> {
  const pending: Pending = { state: oidc.randomState(), nonce: oidc.randomNonce(), verifier: oidc.randomPKCECodeVerifier(), intent };
  (await cookies()).set(PENDING, Buffer.from(JSON.stringify(pending)).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: CALLBACK,
    maxAge: 600,
  });
  return oidc.buildAuthorizationUrl(await signo(), {
    redirect_uri: `${await appOrigin()}${CALLBACK}`,
    scope: "openid email profile",
    code_challenge: await oidc.calculatePKCECodeChallenge(pending.verifier),
    code_challenge_method: "S256",
    state: pending.state,
    nonce: pending.nonce,
    // signo keeps people signed in for days. Club laptops are shared, so signo checks who it is every time.
    prompt: "login",
  }).href;
}

// Finishes the sign-in signo has just sent back: the email signo confirmed, and what the person was doing.
export async function finishSigno(search: string): Promise<{ email: string; intent: Intent } | { error: string; intent: Intent }> {
  const jar = await cookies();
  const kept = jar.get(PENDING)?.value;
  jar.delete({ name: PENDING, path: CALLBACK });
  let pending: Pending;
  try {
    pending = JSON.parse(Buffer.from(kept ?? "", "base64url").toString());
  } catch {
    return { error: "This sign-in took too long or was already used. Start again.", intent: { kind: "signin" } };
  }
  try {
    const tokens = await oidc.authorizationCodeGrant(await signo(), new URL(`${await appOrigin()}${CALLBACK}${search}`), {
      pkceCodeVerifier: pending.verifier,
      expectedState: pending.state,
      expectedNonce: pending.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (typeof claims?.email !== "string" || claims.email_verified !== true) return { error: "signo did not confirm an email address.", intent: pending.intent };
    return { email: claims.email.trim().toLowerCase(), intent: pending.intent };
  } catch (error) {
    if (error instanceof oidc.AuthorizationResponseError) {
      return { error: error.error === "access_denied" ? "Signing in was cancelled." : error.error_description ?? error.error, intent: pending.intent };
    }
    console.error(error);
    return { error: "Signing in with signo failed. Try again.", intent: pending.intent };
  }
}
