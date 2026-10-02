# Data processing agreement: outline (DRAFT)

> Outline for a lawyer to turn into the real agreement. Not legal advice. Text in [square brackets] is undecided. Based on the structure UK GDPR Article 28 requires.

**Parties:** [Club legal name] ("Controller") and [RepReady company] ("Processor").

## 1. What is processed

- **Subject matter and purpose:** helping the Controller's performance staff adjust players' training sessions from daily check-ins.
- **Duration:** while the Controller uses the service, then deletion under clause 9.
- **People:** the Controller's players (aged 18 and over) and staff.
- **Data:** player name or label, shirt number, position, squad; sleep, soreness, stress, availability, optional free-text notes; session effort; optional wearable sleep, HRV and resting heart rate; proposals and the staff decisions on them; staff name, email, role. Players' health data is special-category data.

## 2. Processor duties

1. Process only on the Controller's documented instructions (this agreement and use of the product).
2. Make sure people with access are bound by confidentiality.
3. Keep data secure (clause 5).
4. Use only the sub-processors in clause 4, and tell the Controller before changing them [notice period].
5. Help the Controller answer players' rights requests (access, correction, deletion, withdrawal). The product already lets staff and players delete a player's data.
6. Help with security, breach notification and impact assessments.
7. Tell the Controller if an instruction seems to break data protection law.
8. Allow audits [scope and notice period].

## 3. Controller duties

The Controller decides the lawful basis and Article 9 condition for using players' health data, gives players the privacy notice, and decides who on staff gets an account. [Lawyer: confirm how consent works in an employment relationship.]

## 4. Sub-processors (as of 2026-10-02)

| Sub-processor | Purpose | Location |
|---|---|---|
| Google (Firebase, Firestore) | Database | London (europe-west2) |
| Vercel | Hosting and server code | Functions pinned to London (lhr1); platform logs: [confirm] |
| Resend | Staff emails (password reset, morning digest) | [confirm] |
| Polar Electro | Only if a player connects a Polar device | Finland [confirm] |
| Junction | Wearable aggregator. Webhook exists but is not live | US [confirm]. Not used unless agreed |

No AI model service receives player data in the current product. If one is added, this table and the privacy notice change first.

## 5. Security measures (what the product does today)

- Each club's data is separated; staff reach only their own club.
- The database denies all direct browser access; only the server reads and writes.
- Staff passwords are stored hashed (scrypt). Password-reset tokens are stored hashed, work once and expire after an hour.
- Player links are private, and each works on one phone.
- Staff email digests contain names and counts only.
- Data is encrypted at rest and in transit by the providers' standard settings. [Not independently verified by RepReady.]
- Not yet in place: automatic retention deletion, two-factor sign-in, session revocation on password reset, audit logging of staff access.

## 6. Personal data breach

The Processor tells the Controller without undue delay and within [N] hours of becoming aware, with what happened, what data, and what is being done. [Breach process and contacts to be written.]

## 7. International transfers

[To be completed once each sub-processor's location and transfer mechanism are confirmed.]

## 8. Liability and fees

[For the lawyer and the commercial agreement.]

## 9. End of service

The Controller can delete any player or all data in the product. On request after termination the Processor deletes remaining data within [N] days and confirms in writing. [Backups: confirm how long Firestore keeps deleted data.]
