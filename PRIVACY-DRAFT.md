# RepReady: data flows and DPIA inputs (draft, 2026-10-01)

Not legal advice. This lists what the code does today so a lawyer or the ICO's guidance can be applied to facts. Items marked **open** need a decision before a real athlete is added.

## What is stored

| Data | Source | Where |
|---|---|---|
| Athlete first name or label, random link code | Coach enters it | Firestore `athletes` |
| Consent timestamp | Athlete | Firestore `athletes` |
| Sleep hours, soreness 0-10, stress 0-10, optional free-text note | Athlete check-in | Firestore `checkins` |
| Last-session RPE | Athlete | Firestore `session_logs` |
| Device sleep hours, HRV, resting heart rate, provider | Wearable via Junction webhook (not live yet) | Firestore `readiness` |
| Agent proposal: decision, edits, reason, flag, rule ids, coach decision and note | Agent, coach | Firestore `proposals` |
| Polar access token, Polar user id, last sync time | Athlete connects Polar (OAuth) | Firestore `polar_links` |
| Device sleep, HRV and lowest night heart rate from Polar | Polar AccessLink, pulled on sync | Firestore `readiness` |
| Email address and club name from a pilot request | Landing page form | Firestore `leads` (RepReady only, not visible to clubs) |
| Staff name, email, roles, password hash | Club sign-up or staff invite | Firestore `staff` |

Sleep, soreness, stress, HRV and resting heart rate are health data. Under UK GDPR that is special-category data (Article 9), which needs a lawful basis plus an Article 9 condition. The app asks for explicit consent before the first check-in.

Club staff sign in with email and password (scrypt-hashed). Each club has its own data under `clubs/{club}/` and staff can only reach their own club. Stored per staff member: name, email, roles. Players join by a personal link or a club squad link; the first phone to agree to the terms keeps the link, and staff confirm self-joined players before they can check in.

## Who receives data

| Recipient | What they get | Notes |
|---|---|---|
| Google Firebase (Firestore) | Everything above | Database is in europe-west2 (London), created 2026-10-01. |
| OpenRouter | Per check-in: planned session, 14 days of sleep, soreness, stress, RPE deltas, notes, device figures. Not the athlete's name. | Free-text notes can contain names or health detail. OpenRouter routes to an upstream model provider; one error message during testing showed Amazon Bedrock. Upstream region, retention and training use **open**. |
| Polar (AccessLink) | The athlete authorises read access to their Polar sleep and Nightly Recharge data; we send their link code as a member id | Polar Electro is Finnish, so likely inside UK/EU adequacy, **open**: confirm. A Polar access token is stored per athlete. |
| Junction (webhook receiver exists, not live) | The athlete's wearable account link and sleep data | US company, **open**: transfer terms. |
| Stripe | The coach's payment details, not athletes' | Out of athlete scope. |
| Hosting provider | Request logs | **open**: not chosen. |

## Roles (to confirm with a lawyer)

The coach or their organisation decides why and how athlete data is used, so they are likely the controller. RepReady processes it on their behalf, which would need a data processing agreement. The athlete's relationship is with the coach.

## What exists in the product

- Consent screen before the first check-in, naming the AI model and OpenRouter.
- The coach can delete an athlete and all their check-ins, session logs, device data and proposals (`Remove athlete`, coach page).
- The athlete can delete their own data from their page. Both paths deregister the athlete from Polar before deleting.
- The athlete can disconnect Polar at any time, which deregisters them and removes the stored token.
- Adults only for the pilot. Under-18s would need parental consent and safeguarding rules.
- Firestore rules deny all browser access. Only the server reads and writes.

## What does not exist yet

1. **Retention rule.** Nothing is deleted automatically. **open**: pick a period, for example delete athlete data 12 months after the last check-in, and build it.
2. **Published privacy notice** for athletes, covering the table above, rights (access, deletion, withdrawing consent) and a contact.
3. **DPIA.** A DPIA is likely required: health data, new technology (AI), systematic monitoring. **open**: complete it with the transfer answers above.
4. **International transfer mechanism** for OpenRouter's upstream provider and Junction, if any are outside the UK.
5. ~~Withdrawal of consent from the athlete's side.~~ Done: athletes can delete their own data.
5b. **Waitlist emails** are stored with no stated retention and no unsubscribe link yet. Add both before emailing anyone.
6. **Breach process** and who to notify.

## Decisions needed

1. ~~Firestore region~~ Decided: London (europe-west2).
2. Whether free-text notes go to the model as written, or are dropped or masked first.
3. Whether to use a model route with a no-retention guarantee, and confirm it in writing.
4. Retention period.
5. Who signs the DPA, and the company that is the processor.
