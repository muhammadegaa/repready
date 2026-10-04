# Research synthesis: how to design, develop and deliver RepReady (2026-10-04)

Three research passes were run: competitors, agentic design patterns, and delivery (law, pricing, go-to-market). **Evidence quality is mixed.** Many vendor, review and regulator pages were blocked from the research environment, so a lot rests on search summaries and vendor claims; every legal point needs a lawyer. Treat this as direction, not proof.

## What the research says about where RepReady stands
- **Different in one real way.** Among the dozen products checked (Kitman, Catapult, Smartabase, Teamworks, Metrifit, AthleteMonitoring, Fractall, Output, Zone7, TeamBuildr, Volt, TrainHeroic, WHOOP/Oura), none was found that turns a daily check-in into a bounded change to that player's planned session, with coach approval and earned delegation. Wellness questions, traffic lights and readiness scores are table stakes everywhere.
- **Price pressure from below.** Fractall publishes about EUR 15-20 per team per month, unlimited athletes, a 6-week trial. TeamBuildr is from about USD 90 per month for 50 athletes. Our test price (GBP 79 for 50 athletes, 30-day trial) is near TeamBuildr, well above Fractall.
- **A competitor to our importer.** TeamBuildr has announced an AI program importer for Excel and PDF. Ours must be dependable on messy real files before that ships.
- **Table-stakes gaps:** session load and ACWR, a body-pain map, export (PDF/CSV), reminders, cycle tracking, a native-feeling app.

## Design (what to change)
1. Today is the inbox: **Needs you** (pain, illness) first, then **To approve** with before/after cards and a Why, then **Drafts**, then **Done for you** with Undo, then **Waiting on players** with one Nudge. End state is an explicit "All clear". (Mostly built; missing: Nudge in one place, decline reason.)
2. Four responses per item and no more: Approve, Edit, Not today (with a reason chip), Ask. The reason chip feeds rule tuning.
3. Show a rule's approval record on the card before offering to hand it over; offer once; revoking is one tap; one undo drops the rule back to approval.
4. Push only for pain/illness and same-day fixture changes; everything else in one morning digest; a tested daily cap.
5. Player check-in: five taps or fewer, from a link, no login, ending on the player's day with any change and its reason as the reward. Voluntary, never penalised.
6. Navigation: three tabs plus More, an Ask bar on Today (the plan already written). Never show a player a streak that punishes rest days.

## Develop (in this order)
1. Real-file reliability of the program importer, with a golden set of messy programs and an injection test.
2. Session load: sRPE and a simple weekly load view, then ACWR (buyers compare on this first).
3. Pain body map, with an always-available "something hurts" path that only ever reaches the coach.
4. Decline reasons on proposals; Ask bar; Nudge.
5. Export (CSV/PDF) for staff; a morning digest that actually sends (needs a verified sending domain).
6. Defer wearables/GPS until a paying club asks.

## Deliver (before and during the pilot)
- **Legal basis is the club's, and consent is weak in a club-player relationship.** The club is the controller; we are the processor. Sleep, soreness, stress and notes are health data. Consent between employer and worker is hard to rely on, so our "I agree" screen should be framed as a notice the player acknowledges, check-in must be voluntary, and the club chooses its own legal basis. **[Lawyer]**
- **Publish as product commitments:** wellness data is never used for selection or contract decisions; check-in is voluntary; no academy (under-18) players; delegation mode off unless the coach turns it on.
- **Paperwork:** processor agreement and sub-processor list (Google/Firestore London, Vercel, Resend, the model vendor; Stripe likely separate), a DPIA draft for the club to complete, a player privacy notice, an incident and breach process, a retention schedule, a data-flow diagram. **[Lawyer]** for the agreement, the lawful basis, whether pilot players are workers, and the delegated-reduction mode under the UK automated-decision rules.
- **Register with the ICO** for the data we hold as controller (staff accounts, billing); confirm with the ICO.
- **Free-text notes** are the riskiest field: warn players not to enter diagnoses; coach-only; short retention. Do not infer mood from notes (EU AI Act emotion rules, if selling into the EU).
- **Pricing:** flat per squad-size band, annual option; decide a stance against Fractall (we are a different category: it edits the session) and test willingness to pay in the pilot.
- **Timing:** it is mid-season. Pilot now, convert before pre-season.
- **Channels:** UKSCA and IUSCA events, the S&C community on X and LinkedIn, coach-education courses (effectiveness unproven).
- **Pilot method:** two weeks, written success criteria, a named decision-maker, written permission before naming the club. Check `/admin` daily.
- **Indonesia:** defer until local counsel confirms transfer rules.

## Objections to prepare answers for
"Why not Google Forms?" · "Fractall is cheaper and has load." · "Self-reported wellness is unreliable." · "Will players fill it in?" · "I do not trust an agent near my players." · "What if you disappear?" · "Is this lawful with player health data?"
