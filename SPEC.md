# Adaptive S&C agent: MVP spec (draft 1, 2026-10-01)

## Goal
A coach imports a program, athletes check in daily, an agent proposes reasoned edits to that day's session, the coach approves, the athlete sees the adjusted session. One paying coach using it for a full training week.

## Scope
In (weeks 1–3):
- Coach web app: import a program from CSV or pasted text, view and edit sessions.
- Athlete PWA (no native app): join by link, daily check-in, view today's session, log sets.
- Check-in inputs: session RPE, sleep hours, soreness (body map or 0–10), mood or stress 0–10, free-text note.
- Agent: one run per athlete per day, output is a list of proposed edits with reasons.
- Coach approval queue: approve, edit or reject each proposal, one tap for approve-all-for-athlete.
- Audit log of every proposal, its inputs and the decision.
- Landing page with a payment link (Stripe).

Out until one coach is using it: native apps, Apple Watch (needs a phone app), team feed and messaging, reports, multi-coach permissions, AI-generated programs from scratch.

## Stack
Next.js (App Router), TypeScript, Tailwind, Firebase (Firestore through the Admin SDK, rules deny all client access), OpenRouter (Claude Sonnet 5.5), Stripe. Changed from Supabase and the Anthropic SDK on 2026-10-01: Firestore because the founder chose Firebase and GitHub as the platform, OpenRouter because it is the key available. Hosting is Firebase App Hosting, not yet set up. Wearables go through one aggregator (Junction), not one SDK per brand.

## Data model (minimum)
- `coach`, `athlete` (belongs to coach), `program` → `session` → `exercise_prescription` (sets, reps, load or %1RM, target RPE).
- `checkin` (athlete, date, rpe, sleep_h, soreness, stress, note, source).
- `readiness_signal` (athlete, date, type, value, source). Wearable rows arrive here from the Junction webhook. In Firestore this is a readiness collection keyed by athlete and date.
- `proposal` (athlete, session, edits JSON, reason, inputs snapshot, status, decided_by, decided_at).

## Agent design
- Input: the day's planned session, last 14 days of check-ins and completed loads, athlete constraints (injury notes), and the coach's rule set.
- Rule set: written by the cofounder as plain-language rules with citations (for example "two consecutive days sleep under 6h and RPE 2+ above target: reduce working-set volume 10–20%, keep intensity"). The prompt includes the rules. The agent may not invent a rule that is not in the set.
- Output: structured edits (exercise, field, old value, new value) plus a one-sentence reason and which rule applied. Schema-validated.
- Hard limits enforced in code, not in the prompt: no load increase above plan, volume change capped at ±25%, no edits when an athlete has a flagged injury note unless the coach has marked that exercise as cleared, no medical language in any output.
- Nothing is applied without coach approval.
- Model: Sonnet-class for the daily run. Measure cost per athlete-day during the pilot.

## Evaluation (the pass/fail check)
1. Cofounder writes 30 scenarios: planned session, 14 days of inputs, and the decision they would make (edits and why). Include 8 "do nothing" cases.
2. Run the agent on all 30. Score per scenario: same direction of change (up, down, none), same target exercises, volume change within 10 points of the expert's.
3. Pass: at least 80% agreement overall and 100% on the "do nothing" cases. Below that after two prompt iterations triggers the kill criterion in MEMO.md.
4. Re-run the set on every prompt or rule change.

## Build plan (about 12 hours a week)
- Week 1: rule set and the 30 scenarios (cofounder), schema, program import, agent with evaluation harness. Gate: evaluation result.
- Week 2: check-in PWA, approval queue, audit log, session view.
- Week 3: landing page, Stripe payment link, content post drafts for the cofounder, privacy notice and consent screen (health data), deploy.
- Wearables: the webhook receiver and a local sample-data button exist. Live connection needs a Junction key (sandbox is free, live is $300 a month). The sample button is local-only and must not ship to real athletes.

## Open items
- Domain for RepReady (name chosen 2026-10-01).
- Cofounder hours per week and equity split, in writing.
- UK GDPR: consent wording and whether a DPIA is required. Confirm before any real athlete data.
- Whether athletes under 18 are in scope (school sport). If yes, parental consent and safeguarding rules apply. Default for MVP: adults only.
