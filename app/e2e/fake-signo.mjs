// Stands in for signo (usesigno.co.uk) in the browser tests: an OpenID Connect provider whose sign-in page asks
// only for an email. "Email not verified" and "Cancel" give the answers signo can give besides a confirmed email.
import http from "node:http";
import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";

const port = Number(process.env.FAKE_SIGNO_PORT ?? 3197);
const issuer = `http://127.0.0.1:${port}`;
const client = { id: "e2e", secret: "e2e-secret" };
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "e2e", alg: "RS256", use: "sig" };
const codes = new Map();

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const sign = (claims) => {
  const body = `${b64({ alg: "RS256", kid: "e2e", typ: "JWT" })}.${b64(claims)}`;
  return `${body}.${createSign("RSA-SHA256").update(body).sign(privateKey).toString("base64url")}`;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const form = (req) => new Promise((resolve) => {
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => resolve(new URLSearchParams(data)));
});

http.createServer(async (req, res) => {
  const url = new URL(req.url, issuer);
  const json = (status, value) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(value));
  if (url.pathname === "/.well-known/openid-configuration") {
    return json(200, {
      issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks`,
      response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"],
      code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["client_secret_basic"], authorization_response_iss_parameter_supported: true,
    });
  }
  if (url.pathname === "/jwks") return json(200, { keys: [jwk] });
  if (url.pathname === "/authorize" && req.method === "GET") {
    // Like signo, it sends people back only to a registered callback URL: here, the app on this machine.
    const back = new URL(url.searchParams.get("redirect_uri") ?? "", issuer);
    if (!["localhost", "127.0.0.1"].includes(back.hostname) || back.pathname !== "/auth/callback") return res.writeHead(400).end("redirect_uri is not registered");
    const hidden = ["client_id", "redirect_uri", "state", "nonce", "code_challenge"].map((k) => `<input type="hidden" name="${k}" value="${esc(url.searchParams.get(k) ?? "")}">`).join("");
    return res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><title>Fake signo</title><form method="post" action="/authorize">${hidden}
<label for="email">Email</label><input id="email" name="email" type="email">
<label><input type="checkbox" name="unverified"> Email not verified</label>
<button name="go" value="continue">Continue</button><button name="go" value="cancel">Cancel</button></form>`);
  }
  if (url.pathname === "/authorize" && req.method === "POST") {
    const body = await form(req);
    const back = new URL(body.get("redirect_uri"));
    back.searchParams.set("state", body.get("state"));
    back.searchParams.set("iss", issuer);
    if (body.get("go") === "cancel") back.searchParams.set("error", "access_denied");
    else {
      const code = randomBytes(16).toString("hex");
      codes.set(code, { email: body.get("email").trim().toLowerCase(), verified: !body.get("unverified"), nonce: body.get("nonce"), challenge: body.get("code_challenge"), redirect: body.get("redirect_uri"), client: body.get("client_id") });
      back.searchParams.set("code", code);
    }
    return res.writeHead(302, { location: back.href }).end();
  }
  if (url.pathname === "/token" && req.method === "POST") {
    const body = await form(req);
    const [id, secret] = Buffer.from((req.headers.authorization ?? "").replace(/^Basic /, ""), "base64").toString().split(":").map(decodeURIComponent);
    const grant = codes.get(body.get("code"));
    codes.delete(body.get("code"));
    const pkce = grant && createHash("sha256").update(body.get("code_verifier") ?? "").digest("base64url") === grant.challenge;
    if (id !== client.id || secret !== client.secret || !grant || !pkce || grant.redirect !== body.get("redirect_uri") || grant.client !== id) return json(400, { error: "invalid_grant" });
    const now = Math.floor(Date.now() / 1000);
    const sub = createHash("sha256").update(grant.email).digest("hex").slice(0, 16);
    return json(200, {
      access_token: randomBytes(16).toString("hex"), token_type: "Bearer", expires_in: 300,
      id_token: sign({ iss: issuer, aud: id, sub, email: grant.email, email_verified: grant.verified, nonce: grant.nonce, iat: now, exp: now + 300 }),
    });
  }
  res.writeHead(404).end();
}).listen(port, "127.0.0.1");
