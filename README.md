# RepReady

Session adjustments for strength and conditioning coaches. Athletes check in; an agent proposes one edit to the planned session with the rule behind it; the coach approves, edits or rejects; the athlete sees only what the coach sends.

Three views share one record and update live:

| View | Route | Who | What |
|---|---|---|---|
| Coach | `/coach` | passcode | Today queue, proposal diffs, edit numbers, notes, protected exercises, athlete detail, program import |
| Athlete | `/a/<code>` | private link | Consent, check-in, session with highlighted changes, effort log, Polar connect, delete my data |
| Sports scientist | `/science` | passcode | Edit rules and citations, label 30 scenarios, run the agent against the labels |

## Run it locally

```bash
cd app
cp .env.example .env.local        # OPENROUTER_API_KEY is not needed: rules decide
npm install
# terminal 1: Firestore emulator (needs Java)
npx firebase emulators:start --only firestore --project repready-7dacd --config ../firebase.json
# terminal 2: app against the emulator
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run dev -- -p 3100
# optional: a believable demo week (emulator only, refuses otherwise)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx --env-file=.env.local scripts/seed-demo.mts
```

Tests: `npm test` runs the unit tests; `npm run test:emulator` also runs the Firestore store tests; `npm run test:e2e` runs the browser tests (sign-up and checklist, adding and joining players, a pain note reaching the coach, cross-club isolation, sign-in) against the emulator. Install the browsers once with `npx playwright install chromium`, or set `PW_CHROMIUM` to an existing Chromium. If a dev server is already running on another port, set `E2E_PORT` to it.

## How it fits together

- `app/src/lib/agent/` the rules engine (`engine.ts`) that decides, hard limits in code (`limits.ts`), scoring (`score.ts`), bundled rules and scenarios. `propose.ts` is the older model call, no longer used in the loop.
- `app/src/lib/library/` bundled exercise library, the draft football overlay, and name matching on program import. `app/src/lib/fixtures.ts` match-day tags.
- `app/src/lib/store.ts` all Firestore access. Every write also bumps a pulse document; open views poll it (`components/Live.tsx`) and refresh when it moves.
- `app/src/lib/polar.ts` Polar AccessLink: OAuth with a signed state, registration, sleep and Nightly Recharge sync.
- `app/src/actions/` server actions by role. Coach and scientist actions check the role cookie; athlete actions check the link code.
- `firestore.rules` denies all browser access. Only the server reads and writes.
- `PRIVACY-DRAFT.md` data flows and the open GDPR decisions. `SPEC.md` and `MEMO.md` are the original spec and investment memo.

## Environment

See `app/.env.example`. Hosted use needs `FIREBASE_SERVICE_ACCOUNT` (one-line JSON). Polar needs a client registered at https://admin.polaraccesslink.com with callback `https://<domain>/api/polar/callback`.
