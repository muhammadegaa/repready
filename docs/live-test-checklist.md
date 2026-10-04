# Live test checklist (stage 1: you alone, on the real site, about 45 minutes)

Use two devices: your laptop (coach) and your phone (player). Use a fresh club name and an email you can reach. Tick each line. Anything that surprises you is a finding: write it down, do not fix it in your head.

## Before you start: settings on Vercel (all of these must exist)
- [ ] `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (the program reader needs them)
- [ ] `FIREBASE_SERVICE_ACCOUNT`, `SESSION_SECRET`, `CRON_SECRET`, `APP_URL`
- [ ] `NEXT_PUBLIC_PAYMENT_LINK`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY` (Stripe still in test mode)
- [ ] `PLATFORM_ADMIN_EMAILS` (your sign-in email)
- [ ] Optional: `RESEND_API_KEY` + a verified `MAIL_FROM` (email), `COMPED_CLUBS` (a free club)
- [ ] Latest deployment is Ready (green) and is the branch you expect

## 1 Coach: first run
- [ ] Sign up with a new club. You land on "One step left" (payment gate).
- [ ] Pay with the Stripe test card `4242 4242 4242 4242`. You come back to the app and go straight to Today. Note how long it took.
- [ ] Today shows the 4-step checklist. Nothing looks broken or confusing.
- [ ] Load the sample squad, look at Today, Squad, Map, Results. Remove the sample squad.

## 2 Coach: your real program (the biggest unknown)
- [ ] Paste a real week of your own program into Program (text, then try a spreadsheet). Press Read my program.
- [ ] Check the draft: every session, exercise, set, rep and load against what you wrote. Count the mistakes.
- [ ] Say a change in words ("make Friday a deload"). It does it, and nothing else changes.
- [ ] Use this program. Sessions appear under Upcoming.
- [ ] Paste a squad (names as you have them, with and without shirt numbers). Check the preview, add.
- [ ] Link a real club calendar, or type fixture dates. Check which events it took.

## 3 Player: on your phone
- [ ] Open a player's link on your phone. Agree to the terms. The page reads clearly.
- [ ] Check in with normal numbers. Then, on another player, check in with two bad nights and a pain note.
- [ ] Back on the laptop: Today shows a suggestion for the short sleep and a flag (no edit) for the pain note.
- [ ] Approve the suggestion. The phone shows the changed session. Keep the plan on another: the phone shows it unchanged.
- [ ] Open the same player link on a second device. It must refuse (one phone per link).

## 4 The agent doing its job
- [ ] Squad map: players you made look worse show up, squares make sense against "their own usual".
- [ ] Draft next week (Thursday to Sunday, or Program → Start from this week). Dates and match days look right.
- [ ] Log match minutes the day after a fixture.
- [ ] Results page shows the check-in rate and your decisions.

## 5 Things that must not work
- [ ] Open `/admin` while signed in as a normal club account: not found. As your admin email: the pilot view.
- [ ] Five wrong passwords: the sixth ... eighth then "Too many attempts".
- [ ] Delete a player. Delete the club (type its name): you are signed out and cannot sign back in.

## What to send me
For every item that was wrong, slow, confusing or ugly: the screen, what you expected, what happened. A screenshot is enough. Also: how many mistakes the program reader made out of how many exercises.

# Stage 2: one friendly club (2 weeks)
Success criteria, agreed up front (Soh, ch. 9): the program is confirmed in the first week; at least half the squad checks in on most days by week 2; the coach decides most suggestions the same day. Check `/admin` every morning. Contact the coach on day 3 and day 7 whatever it shows. Ask for: what was wrong, which suggestions they would not have made, what they stopped using.
