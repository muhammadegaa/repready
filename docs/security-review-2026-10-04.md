# Security review, 2026-10-04 (internal; before the first real club)

Scope: the whole app on branch `claude/jolly-curie-vqeims`. Method: read every server action and route that takes an id or a link, check each for club scoping and device ownership, then probe the new surfaces (payment, calendar fetch, file upload, admin page, autonomy). Not a penetration test. No external review has been done.

## Fixed in this pass
| Finding | Fix |
|---|---|
| No limit on password guesses | Failed sign-ins counted per email (8) and per network address (40) in 15 minutes; then locked for 15. Tested. |
| No security headers | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin` (the player link is a secret in the address), `Permissions-Policy`, HSTS. Tested. |
| A player's consent to the updated wording could be recorded by anyone holding the link | Agreeing to an update now requires the phone that owns the link. |
| A spreadsheet is a zip; a small file could unpack to gigabytes | Declared unpacked sizes are read from the zip's directory first; over 60 MB, or too many entries, is refused. Tested. |
| Calendar link fetch checked the address, then connected separately (DNS rebinding) | The address is checked inside the connection itself; https only, no redirects, 2 MB cap, 10 s. |
| With no email key set, the mail log printed the whole message, including reset links | Body is no longer printed in production. |

## Checked and sound
Every id-taking coach action is scoped to the signed-in club (proposal ids, drafts, overrides, minutes, autonomy, delete-club); player actions require the phone that owns the link; staff removal and invites are admin-only and club-scoped; Stripe webhook verifies the signature and age; the checkout lookup requires the club id to match; cron endpoints use a constant-time secret; the QR code is the only `dangerouslySetInnerHTML` and it is library output of our own URLs; model output is schema-validated and rendered as text; player names are replaced by codes around every model call; Firestore is reached only from the server (rules deny all client access).

## Known and accepted for the pilot (decide before scale)
1. **The pilot-health page trusts the email on the account.** Email is not yet confirmed (sending is off). Anyone could register an admin email that nobody has registered yet. Register your admin email first (you have), and turn on email confirmation and require it for `/admin` once a sending domain is verified.
2. **Sessions last 30 days and cannot be revoked** (a password reset does not end other sessions). No two-factor sign-in.
3. **Sign-up reveals whether an email already has an account** (it says so). Normal for this stage.
4. **A locked-out email can be locked by anyone for 15 minutes.** The price of the guess limit.
5. **No audit export, no data-retention automation** (a retention period is still to be decided).
6. **Sub-processor terms** (OpenRouter upstream, Resend, Vercel logs) are unconfirmed in the processor table.
7. **No external penetration test.** Dependencies: `npm audit` shows two moderate advisories in `uuid` (reached through `firebase-admin`); the flaw needs a caller-supplied buffer, which the library does not do. CI now fails on any high or critical advisory in production dependencies.
