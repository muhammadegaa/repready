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

## Step 6 status

Player session view shows a picture only for an exact library match (or a football entry whose own name or alias is exactly a library name). Pictures are served through `/api/exercise-image/[id]` from a pinned free-exercise-db commit, cached for a year, so players' phones never contact GitHub; the route only resolves ids in the bundled library. Changed values were already shown struck-through and highlighted. No picture exists for Nordic hamstring curl, Copenhagen adduction and other football-specific entries; they show text only. Not done: instructions text, multiple images per exercise, self-hosting the images.

## Coach point of view (added 2026-10-03, from the canvas boards "Coach jobs in detail" and "How one player's session is built")

Decisions taken (the production-grade options): named groups the coach creates; a group version is a full session for that group (a `group` column in the program CSV), chosen over the earlier idea of a diff on the base because coaches already keep one sheet per group; a player override is a standing instruction per player and exercise (swap, cap on sets or reps, lower load, optional end date and review date) until lifted; the player is told it is a personal change from the coach, never the reason; per-player 1RM waits until the pilot club says it prescribes by percentage; the head coach is not a user yet.

| Slice | State |
|---|---|
| S1 Groups | Done. Group column in the CSV, bulk assignment on Squad, the player's own version used by Today, the player's screen, the rules and the proposal form. One function picks the session |
| S2 Player overrides | Done. Editor on the coach's player page, shown to the player as changed by the coach, the rules work from the changed plan, review reminders on Today, lift |
| S3 Assess | Partly. Today against the player's own usual range (mean plus or minus one standard deviation, at least 5 earlier days, minimum room of half an hour of sleep or one point). Not yet: load and minutes, a dated return note, a "plan with its sources" per row beyond the change label |
| S4 Load, minutes, tests | Not started. Waiting on the pilot club (decision D4) |
| S5 Sample squad | Started (a `sample` flag on athletes exists). Not built |

Not verified: the live site (everything above was run against the emulator and on GitHub's runners), and the scientist's rule thresholds are still fixed in code.

## Input without difficult formats (added 2026-10-03)
Principle: give it whatever you have; it reads it; you confirm. No coach or player is asked to write a raw format.
- **Program**: pasted text or a spreadsheet is read by a model into a draft (`/coach/program/review/[id]`). The coach fixes dates, drops sessions, or says what is wrong in words, then presses Use this program. Nothing reaches players before that. Every model answer is validated in code (zod, dates, limits). CSV remains under Advanced.
- **Squad**: read in our own code (any column order, header or none, positions in shorthand, a group column), shown for a check, then added. No model, because rosters carry player names.
- **Fixtures**: read in our own code from the formats coaches write; unreadable lines are listed, good ones kept.
- **Tests**: unit tests per reader; the browser suite runs against a fake model server (`app/e2e/fake-llm.mjs`), 12 tests. CI green on 729ea48.
- **Open**: the program reader has not run against a real model (no route to OpenRouter from the build sandbox): check with a real week before the pilot. Upstream provider region/retention/training use for OpenRouter is still to confirm (see PRIVACY-DRAFT.md).

## Payment gate (2026-10-03)
Set `NEXT_PUBLIC_PAYMENT_LINK` (Stripe Payment Link) and the product is gated: a new club signs up, lands on `/subscribe`, pays through the link (the club id travels as `client_reference_id`), and Stripe's `checkout.session.completed` webhook (`/api/stripe/webhook`, verified with `STRIPE_WEBHOOK_SECRET`) marks the club paid. `COMPED_CLUBS` (comma separated club ids) lets a club in without paying. No link set means no gate. Build diagnostics removed after the Vercel build was confirmed working.

## Email confirmation (2026-10-03)
Sign-up and staff-invite acceptance send a confirmation link (24 hours, single use, voided if the address changes). Until confirmed the coach sees a banner with a resend button, and the morning digest is not sent to that address. A completed password reset also confirms the address. Existing accounts show as unconfirmed until they use the banner or a reset.

## Match minutes (2026-10-03)
Program page, "Match minutes": the coach jots who played ("Ola Adeyemi 90", "Ortiz 65", "Sam DNP"); names are matched in our own code (never guessed between two players), shown for a check, then saved per player and date. Shown on each player's page for the last 14 days with a total. **It does not change any session and no rule uses it yet**: the thresholds that should (for example a heavy match week) are a sports scientist's call, so they wait for the pilot club's input. Training load beyond minutes is still not started.

## Returning from Stripe (2026-10-03)
In the Stripe payment link set "After payment: redirect to your website" to `https://<domain>/subscribe?session_id={CHECKOUT_SESSION_ID}`. The Subscribe page then asks Stripe whether that checkout was paid for this club (needs `STRIPE_SECRET_KEY`, a restricted key with read access to Checkout Sessions) and opens the club straight away; the webhook (`STRIPE_WEBHOOK_SECRET`) remains the backstop. While neither has confirmed, the page says "Payment received" and checks again every few seconds.

Email confirmation is off by default (no banner, digest to every coach address) until `REQUIRE_EMAIL_CONFIRMATION=1` is set, which should wait for a verified sending domain in Resend and `MAIL_FROM`. Paid clubs now open from Stripe's own record (`STRIPE_SECRET_KEY`) even if the redirect and webhook did not fire.

## Agentic coach flows, first slice (2026-10-03; see docs/user-journeys-DRAFT.md)
- **Fixtures from the club calendar**: paste an iCal link once (Program → Fixtures); match-like events are taken, shown to the coach, and read again each morning (`/api/cron/calendars`, 05:30 UTC). Typed dates and calendar dates are one list. The link is fetched over https only, never to a private address, no redirects.
- **"Who played?"**: on the day after a fixture with no minutes logged, Today asks once and links to the minutes form with the date filled in.
- **Squad map** (`/coach/map`): every player down the side, the last 14 days across, each square that player's day against their own usual (the day itself left out), match days, minutes, flags and standing changes on it, "trending down" and "quiet" marked, players needing a look first within each group. Descriptive only.
- **Not yet, and why**: "draft next week" (next to build), standing changes in words (needs the name-privacy decision), auto-reminders (needs a player channel), delegated approvals (needs the product-promise decision).
- **Draft next week** (added): Program → "Start from this week", and a prompt on Today from Thursday to Sunday when next week is empty. Copies the previous week a week on (groups and deloads kept, sample sessions left out), points out the sessions that fall within three days of a match in the fixtures, then opens the same review screen as a pasted program (fix dates, say what is different in words, Use this program). Plain code, no model unless the coach asks for a change in words.

## Theme and brand (2026-10-03)
One light theme (the near-black automatic dark mode is removed; `color-scheme: light`). Cool light page, white cards, slate text instead of near-black, one brand blue (`--brand` #2f6bed) for primary buttons, the active tab, selected pills, progress and the landing call to action. The yellow highlighter stays as the accent for "this value was changed". New mark: a tick ("ready") on brand blue with the highlighter dot; `app/icon.svg` is the favicon. Status colours (green/amber/red) are unchanged because they carry meaning.

## Palette B and name redaction (2026-10-03)
Palette **B, pitch and chalk**: chalk-white page, deep pitch-green actions and active tab (`--brand` #0f6b4f), slate-green text, signal lime (#d7ff3f) only where a value was changed. Status colours unchanged. Every model call now goes through `withRedaction`: known player names (full names and each part) become codes before the call and are restored in the answer; the browser test uses a fake model that fails the request if a name arrives.

## Autonomy ladder (2026-10-03; approved by the founder; see docs/agentic-standard-DRAFT.md)
0 Suggest (always). 1 **Approve together**: Today groups two or more routine suggestions (plain reductions, nothing flagged, nothing the limits changed, no pain/illness/availability rule) for one approval. 2 **Handle it**: on Results, per rule, the coach can hand a rule to the agent once it has earned it (at least 8 of the coach's own decisions in 28 days, 9 in 10 approved exactly as proposed); the agent then applies routine trims at check-in, they show under "Handled for you" with "Take it back", and they do not count towards the rule's record. A "Pause all" switch and an "Always ask me" switch per player override everything. 3 **Never automatic**: R6 illness, R7 pain, AV availability, rest, swaps, increases, flags, anything the limits changed.

## Trust page and trend nudges (2026-10-04)
`/trust` states in plain terms what the product does and never does, how much it does on its own (the autonomy ladder), where data goes (London database, rules in our code, the model sees only program text with names replaced by codes), and what is unfinished (rules not yet reviewed by a sports scientist). Linked from every footer. Today now has "Worth a look": players trending down, or who used to answer and have gone quiet for three days (a player who has never answered is new, not quiet).
**Consent wording changed**: the player consent text, the landing FAQ and the privacy notice draft now say a coach may hand routine small reductions to the agent (undoable). Players who consented earlier saw the old wording: before any rule is handed over for a club, re-ask them to agree. Not built yet; no club has delegation on.

## Re-consent for the autonomy wording (2026-10-04)
Consent is versioned (`lib/consent.ts`, version 2 adds "a coach may hand routine small reductions to the agent"). New players agree to version 2. A player on version 1 sees a short "small update" card on their page once any rule is handed over, can keep checking in as normal, and until they agree the agent never auto-applies anything for them (their suggestions come to the coach). Results shows the coach how many players have not yet agreed. Tested against the emulator.

## Pilot health view (2026-10-04)
`/admin`, for the people listed in `PLATFORM_ADMIN_EMAILS` (404 for everyone else): every club with four milestones (program confirmed, players agreed on their own phones, half the squad checking in over 7 days, coach deciding most days), the next milestone, and signals to act on (not subscribed, no program after a week, coach set up and nobody joined, no check-ins in 7 days, suggestions piling up). Also the waitlist (it was stored but never shown). Sample players and sessions never count. Set `PLATFORM_ADMIN_EMAILS` in Vercel to your own sign-in email.

## Rule tuning, bounded and coach-approved (2026-10-04)
Four rules now take the club's own number instead of a fixed one (R1 sleep, R2 effort overshoot, R3 soreness, R4 stress), each with a default (unchanged behaviour), a safe range and a step (`lib/agent/thresholds.ts`). The rule text a coach reads carries the club's number. Results → "Tuning the rules": when a rule has had at least 8 of the coach's decisions since it last changed, with the plan kept for 6 in 10 or more (only suggestions where that rule was the whole reason, and never the agent's own), the agent offers to loosen it one step ("fire a little less often"). Yes applies it, Not now snoozes 14 days, "Back to standard" resets. The server recomputes the suggestion before applying, so a forged form cannot set any other number. The hard limits are not tunable. Only loosening is ever offered; tightening is left to the scientist's judgement.

## Navigation: Today does its own jobs
- Tabs are now Today, Squad, Program, plus More (Agent, Staff; Rules and Evaluation for scientists).
- Results became Agent (`/coach/agent`); the map is a view inside Squad (`/coach/squad?view=map`, default once there is data).
- Today handles joiners and match minutes inline, so a normal day does not need another tab.

## Navigation proof (2026-10-04)
- **A normal morning from Today alone** is now an e2e test: confirm a joiner, say who played, approve the routine trims together, and see what the agent handled ("Handled for you"), with the address staying on `/coach` throughout. The morning's data is written the way players and the cron would write it; every coach action is a click. The check that approving really trims is the Adjusted counter (two approved plus one handled).
- **Draft next week from Today** returns to Today. The draft remembers where it started (`origin`), so the review says "← Today", Use this program lands on Today with "Saved N sessions", and Discard returns to Today. Started from Program, it stays in Program. The browser test for it only runs Thursday to Sunday, the days Today offers it.
- **Phone header bug found by the screenshots and fixed:** the tabs, More menu and Sign out did not fit 390 pixels (More was cut off). Tabs now take their own row on small screens and the menu opens inside the screen. Regression test added and shown to fail on the old layout.
- Back links already said Today; the only exception is the review of a program started in Program, which goes back to Program. Page and function names match the new names.
- Screenshots: `docs/screenshots/navigation/` (README there).
- The live test checklist now describes the three tabs and More, the inline joiner and minutes jobs, the old addresses redirecting, and a "normal morning from Today alone" section.

## Landing page: three beats (2026-10-04)
The landing page now says "Players check in. The agent adjusts. You approve." and shows each beat as the agent doing it: squad tiles turn from not-in to in (18 of 24, three amber for the coach), the proposal's numbers change with a wipe, then Approve becomes Sent. One email field replaces club plus email (the club is asked in the reply). The paragraph, how-it-works list, control list and FAQ are gone from the page; three short limits and links to `/trust` and sign-up remain. Chosen from three directions on a design canvas; before and after screenshots in `docs/screenshots/landing/`.
- **Motion:** one-shot CSS animations that end on the natural state, replayed every 14 seconds by `components/landing/Beats.tsx` (fade, restart, play), paused while the tab is hidden. Reduced motion: nothing animates; the proposal shows finished but not yet approved. Transform and opacity only, plus hover, press and focus feedback on the form.
- **Tests:** `e2e/landing.spec.ts`: the three beats and one heading, the form (bad email refused, good email thanked), phone fit, the sequence reaching "Sent", and reduced motion.
- **Dropped from the page, still true on `/trust`:** the FAQ answers (who sets the rules, devices, academy players). The rules not yet being reviewed by a sports scientist is stated on `/trust`; check that it still is before sending the page to anyone.
- **Not done:** photography, a sound or video asset, a pricing line (price is still undecided), a second call to action lower down.

## Visual and alive app (2026-10-04; plan in docs/visual-plan-DRAFT.md)
- **Motion system (done):** three durations, one easing curve, one stagger in `globals.css`; list entrances on Today; numbers that count when a check-in arrives while you are looking; cards that ease away when decided and return if the decision is refused; button press feedback. Reduced motion turns all of it off. A loading skeleton was tried and removed: a `loading.tsx` makes Next stream the page, so the response goes out as 200 before the page decides to show "not found" or redirect, which lost the 404 for another club's player and the HTTP redirect for a logged-out visitor (the cross-club browser test caught it). A skeleton can come back inside the page, after the sign-in check, as a Suspense around the slow data.
- **Charts (done):** check-ins as a ring on Today; each measure on a player's page as a line against that player's own usual range, with effort as bars up or down from the plan; the week around the match on Program; the autonomy ladder, outcome bar and each rule's approval record on Agent. Each draws in once, has a text alternative, and shows its finished state under reduced motion. Hand-written SVG, no chart library. The Agent page's ring and bars appear only once a club has real (non-sample) data.
- **Movement figures (done, draft):** a "Show me" link under an exercise opens a sheet with a stylised side-view figure: play and pause, 1×, ½× and ¼× speed, scrub, a row of key positions, the phase named as it plays, and short cues. Three exercises: box jump, drop jump and Nordic hamstring curl. Exercises without a figure but with an exact library match show the library's two pictures fading into each other; others show nothing.
- **What is NOT done and why it matters:**
  - **The three shipped figures are still hand-placed.** The capture step is now built (below) but not yet used on your reps. A unit test keeps bone lengths constant, which caught a stretched thigh in my first drop jump.
  - **No figure has been reviewed by a sports scientist.** Each says so on screen (`reviewed: false` in the data; a test asserts that until someone changes it on purpose). Technique and cues are a coaching statement and are theirs to approve.
  - Every keyframe of all three was looked at on a pose sheet and the sequences read as the intended movements, and the box jump was played on a phone. They are crude stick figures: capture from real video should replace the hand-placed poses before anyone relies on them.
  - Figures show only in the player's session view, not yet in the coach's program review.
  - Still to do from the plan: ten more exercises, the pain body map, page transitions.
- **Tests:** `src/lib/charts.test.ts`, `src/lib/movement/movement.test.ts`, the second-frame image route test, and `e2e/visual.spec.ts` (ring, trend charts, week strip, ladder, the figure sheet, the picture fallback, reduced motion).

## Capture step: film to figure (2026-10-04)
`tools/pose-capture/run.sh VIDEO META.json [--write]`: MediaPipe finds 33 body landmarks per frame on this computer (nothing uploaded), `app/src/lib/movement/capture.ts` turns the camera-side ones into our eight joints, and a review page shows each keyframe's video frame with the detected joints beside the figure we would draw, plus an animated preview and the timeline for placing phases. `--write` saves the figure as unreviewed and regenerates the figure list, so a new figure needs no code change. Guide for filming: `docs/filming-guide.md`; setup and meta file: `tools/pose-capture/README.md`.
- **How it works:** pick the side facing the camera; smooth the joints; trim to the active part (or `startS`/`endS`); mirror so the figure travels right; scale so the torso is 62 units and the floor is 300; find the box or pad from where the feet end up; rebuild with the canonical bone lengths, anchoring a planted foot; keep adding the frame the current keyframes describe worst, until the fit is within 7 units or there are 10.
- **Interpolation changed for the whole app:** it now follows bone angles and the hip's position along monotone curves and rebuilds the body, instead of easing joint positions. The old way snapped a swinging arm and needed far more keyframes for real motion. Bones keep their length at every instant; feet stay planted between two planted keyframes.
- **What was tested:** synthetic reps (our figures turned into landmarks with noise, a lead-in, mirroring) come back as the same movement, with the scene found and the warnings firing; the command itself runs on them; HEVC video and a rotation flag go through the detector; a real person (a public-domain US Army drill clip, used only for testing and not stored) is found in every frame and the review page showed the detected joints on them.
- **What was NOT tested:** a real side-on rep of a box jump, drop jump or Nordic. The only real footage was front-on, which correctly produced the "not side-on" warning. How well the figure follows a real side-on rep is unknown until you film one.
- **Version note:** MediaPipe 1.0.1 crashed at start-up on this Mac ("Service is unavailable"), so `tools/pose-capture/requirements.txt` pins 0.10.21.

