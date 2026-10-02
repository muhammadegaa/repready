# RepReady MVP plan (2026-10-02)

Supersedes the earlier "proposed work" list in chat. Inputs: RESEARCH-ICP.md, RESEARCH-BUILD-VS-ADOPT.md, PRIVACY-DRAFT.md and the design canvas (jobs, forces, job map, blueprint, signals, human and AI split).

## Decisions made

1. **Rules first, model optional.** Code decides who is flagged and generates the candidate edits inside hard limits. The model may pick among those candidates and draft the wording, and it classifies free-text notes (it can only raise a flag). With no flag there is no model call. If the model is down, the digest still goes out.
2. **Calibration mode is deferred.** The MVP records every staff decision (approve, edit, keep) with the rule and the proposal. That gives passive labels for scoring. Show-staff-decide-first comes after the pilot.
3. **The sports scientist reviews the football exercise overlay**, with the pilot club's S&C lead checking names and aliases in week one.
4. **The program is the spine.** Staff import their own program. We do not build a program builder.

## The essential flows

| # | Flow | State |
|---|---|---|
| 1 | Club, staff and player onboarding | Built. Password reset still missing |
| 2 | Program import: library match, match-day tags, fixtures | Partly built (CSV import only) |
| 3 | Morning loop: link, adaptive check-in, rules, inbox, approve, player sees the session | Built with a model-first agent. Needs the rules-first rebuild |
| 4 | Pain and illness flags routed to staff | Partly built |
| 5 | Chase: who has not checked in, remind the group | Not built |
| 6 | Staff digest by email | Not built |
| 7 | Reliability: failure banner, retry, rules-only fallback | Not built |
| 8 | Privacy notice, DPA and DPIA drafts, corrected claims | Drafts only |
| 9 | Pilot instrumentation and a payment link | Not built |

## Build order and hours (at about 12 hours a week)

| Step | Work | Hours |
|---|---|---|
| 0 | OpenRouter credit and spend cap, failure banner and retry, push and deploy | 4 |
| 1 | Rules engine, candidate edits inside limits, optional model chooser and explainer, fallbacks, decision records | 14 |
| 2 | Library import, football overlay, alias matching in program import, match-day tags, simple fixtures | 14 |
| 3 | Adaptive check-in: availability item, quiet-day path, confirm-from-device screen | 8 |
| 4 | One normalised signal record, Polar mapped onto it | 4 |
| 5 | Email provider: password reset, email verification, staff digest. Rate limits. Reminder button and not-in list | 14 |
| 6 | Player session view with exercise images and changed values | 5 |
| 7 | Privacy notice, DPA template, DPIA draft, corrected landing claims | 6 |
| 8 | Browser tests for the core flows and cross-club checks | 8 |
| 9 | Pilot pack: offer, payment link, metrics page | 6 |
| | **Total** | **83** |

That is about seven weeks. A pilot-ready cut is steps 0, 1, 2 (minimal), 3 (without the device screen), 5 (digest and password reset, no verification), 6, 7, 8 (smoke tests) and 9, about 58 hours, five weeks.

## Deferred

Calibration mode. Oura adapter (build once the pilot club names its devices). Whoop, Garmin, Apple and Android. Open Wearables and paid aggregators. GPS import beyond CSV. Head coach as a user. Multi-club staff accounts. Women's cycle tracking. Native app.

## Open items

- Confirm the scheduler. Vercel cron limits depend on the plan. Not verified.
- A lawyer should confirm the WhatsApp doorbell approach and consent in an employment relationship.
- First club and what devices its players use.
- The sports scientist's review time: the overlay (about 1.5 hours) and the 10 rules.

## Progress (2026-10-02, branch claude/jolly-curie-vqeims)

| Step | State |
|---|---|
| 1 Rules engine | Done. `app/src/lib/agent/engine.ts` decides; the model is out of the morning loop. Scientist's evaluation scores it. Note matching is keyword-only; a raise-only model classifier is optional and would need the consent text and PRIVACY-DRAFT changed first |
| 2 Library, overlay, aliases, match-day tags, fixtures | Done at minimum. Overlay is an unreviewed draft. No rule uses `match_day` yet: that needs the scientist |
| 3 Adaptive check-in | Availability item and device-sleep confirm done. Quiet-day "I'm good" tap deliberately not built: it would invent soreness and stress values |
| 4 Signal record | The record already existed (`ReadinessRow`: Polar, Junction webhook and samples write to it). Added `oura.ts` mapper and client. Not verified against the live Oura API (host blocked in the build sandbox). Oura OAuth connect flow and UI not built |
| 5 Email, reset, digest, chase | Done: Resend behind `mail.ts` (logs when no key), password reset (hashed one-hour single-use token, throttled, same reply for unknown emails), morning digest at `/api/cron/digest` (closed without CRON_SECRET), not-checked-in list with copyable reminders. Not done: email verification at sign-up, rate limits beyond the reset throttle, a verified sending domain. Existing sessions are not revoked on reset |
| 6 to 9 | Not started: player session images, privacy documents (notice, DPA, DPIA), browser test suite, pilot pack. Open: Vercel deployments were failing; cause not yet found |

Testing so far: unit tests, Firestore emulator tests (74 passing) and manual browser runs against the emulator. No automated browser tests yet (step 8). Polar has not been run against a real device in this branch.

## First-run experience (added after review feedback)

- Coach: sign-up now lands on Today with a four-step Getting started checklist computed from real state (players, program, links agreed, first check-in). Squad shows a confirmation after adding players and keeps a pasted list when one line is bad.
- Player: a first-time card on the check-in page (add to home screen).
- Scientist: a three-step review guide, and the Rules page now says plainly that editing a rule's text does not change its thresholds (they are fixed in code); only Delete changes behaviour. Making thresholds editable is a real gap to decide on.
- Not browser-verified: the player first-time card (needs a program in place) and the scientist guide.

## Step 8 status

`app/e2e/core.spec.ts`: six browser tests pass against the emulator (checklist, bulk add keeps list, squad-link join and confirm, pain note flag with exercise-alias matching, cross-club 404, sign-in guard). Not covered: password reset (needs the mailed token), digest, Polar, the player's RPE log, program import errors, mobile layouts. No CI workflow yet.
