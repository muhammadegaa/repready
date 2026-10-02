# Build versus adopt (desk research, 2026-10-02)

Only a Polar device is available for testing. Everything below is from public repos and vendor docs, plus one check I ran on the exercise dataset. "Not verified" means I did not test it.

## Exercise library

**free-exercise-db (adopt)**
- Unlicense (public domain). 876 exercises as JSON with images. Fields: name, force, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions, category, images.
- Categories: 584 strength, 123 stretching, 61 plyometrics, 38 powerlifting, 35 olympic weightlifting, 21 strongman, 14 cardio.
- Checked 33 football S&C terms against it. Present: trap bar deadlift, Romanian deadlift, hip thrust, split squat, box jump, sled, Pallof press, calf raise, hang clean, power clean, many lunges, jumps and hops.
- Missing: Nordic hamstring curl, Copenhagen adduction, back squat (stored as barbell full squat), medicine ball by that short name. So the staples of football injury prevention need our own overlay of roughly 30 entries, tagged with movement pattern, muscle group and safe swaps. A sports scientist should review it.

**wger (skip)**
- Application code is AGPL-3.0-or-later. Exercise data is under Creative Commons licences set per entry. Self-hosting is a Docker setup. It is a consumer fitness tracker, and AGPL adds obligations if we modify or embed it. Not worth it for the MVP.

## Programs

- **Do not build a program builder.** Staff already write programs elsewhere. The MVP imports a program (CSV now), maps exercise names to library entries, and tags each session with its match-day offset.
- Open-source builders found (streprogen, routine-engine, several single-file trackers) are consumer or hobby tools. None is aimed at team-sport match-week planning. Not evaluated in depth.
- Match-day-based progression and the agent's edit rules stay custom. I found no open-source project for it.

## Wearables

| Source | Access | Cost | Test without the device |
|---|---|---|---|
| Polar | AccessLink is self-serve with no approval. Rate limits grow with registered users (500 + 20 per user per 15 min, 5,000 + 100 per user per day). The licence lets you distribute to corporate customers. | Free | Real device (owned) |
| Oura | API free. Up to 10 users, then Oura approves the app | Free | Sandbox endpoints return fake data, no ring or account needed |
| Whoop | API limited to 10 members until approved | Free | No sandbox found |
| Garmin | Developer program: new applications paused, per Terra's blog | Possible licence fees | Not testable |
| Apple Watch and iPhone, Android | On-device only. Needs a native app | Free | Aggregator demo users |
| GPS vests (Catapult, STATSports) | CSV export and APIs. The club grants access | Club's own licence | Sample CSVs only |

**Open Wearables (defer).** MIT licence. Covers Garmin, Oura, Whoop, Suunto, Polar, Ultrahuman, Strava, Fitbit, Withings and Google Health in the cloud, and Apple Health, Samsung Health and Health Connect through mobile SDKs. Each deployment serves one organisation (no multi-tenancy). Needs Postgres, Redis and a Celery worker, so a server, not Vercel. Useful later if breadth matters; too heavy for a first pilot.

**Paid aggregators (defer).** Reported: Junction $0.50 per user a month with a $300 minimum; Terra from $399 a month; Rook $399 for 750 users; Spike from $450 a month. Junction offers demo users for Apple HealthKit, Fitbit and Oura. Terra has a data simulator.

## Recommendation for the MVP

1. Exercise library: import free-exercise-db, add the football overlay.
2. Program: CSV import with library matching and match-day tags. No builder.
3. Wearables: Polar (built) and Oura through direct APIs, tested on its sandbox. One normalised signal record so more providers drop in later.
4. Load and minutes: CSV import from Catapult or STATSports, or a 30-second manual entry.
5. No aggregator and no Open Wearables until a club needs Apple Watch or Garmin coverage.

## Sources

- https://github.com/yuhonas/free-exercise-db
- https://github.com/wger-project/wger
- https://github.com/the-momentum/open-wearables
- https://www.polar.com/en/legal/polar-api-agreement
- https://openwearables.io/docs/providers/polar-api-integration
- https://pinta.land/posts/oura-sandbox/
- https://docs.junction.com/wearables/providers/test_data
- https://tryterra.co/blog/garmin-connect-developer-program-pause
- https://sahha.ai/blog/can-a-web-app-read-apple-health/
- https://github.com/tommyod/streprogen
