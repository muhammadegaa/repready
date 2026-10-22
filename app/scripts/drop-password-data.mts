// Run once after staff move to signo: removes what passwords left in Firestore (password hashes, reset and email-confirmation
// records, sign-in attempt counters). Against the real database, with FIREBASE_SERVICE_ACCOUNT set:
//   FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" npx tsx scripts/drop-password-data.mts
// Against the emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/drop-password-data.mts
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const account = process.env.FIREBASE_SERVICE_ACCOUNT;
initializeApp(account ? { credential: cert(JSON.parse(account)) } : { projectId: process.env.FIREBASE_PROJECT_ID ?? "repready-7dacd" });
const db = getFirestore();

const staff = await db.collection("staff").get();
let fields = 0;
for (const d of staff.docs) {
  const old = ["pw", "reset_requested_at", "verify_requested_at"].filter((k) => d.get(k) !== undefined);
  if (!old.length) continue;
  await d.ref.update(Object.fromEntries(old.map((k) => [k, FieldValue.delete()])));
  fields += old.length;
}
const removed: Record<string, number> = {};
for (const c of ["resets", "verifications", "login_guard"]) {
  const q = await db.collection(c).get();
  await Promise.all(q.docs.map((d) => d.ref.delete()));
  removed[c] = q.size;
}
console.log(`Removed ${fields} fields from ${staff.size} staff records, and these records:`, removed);
