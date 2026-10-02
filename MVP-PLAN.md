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
