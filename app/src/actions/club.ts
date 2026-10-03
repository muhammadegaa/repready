"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, signOut } from "@/lib/auth";
import { deregister } from "@/lib/polar";
import { createStaffInvite, deleteClub, listAthletes, removeStaff, revokeInvite, squadInvite, type StaffRole } from "@/lib/store";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function inviteStaff(f: FormData) {
  const { club } = await requireAdmin();
  const want = text(f, "roles");
  const roles: StaffRole[] = want === "both" ? ["coach", "scientist"] : want === "scientist" ? ["scientist"] : ["coach"];
  await createStaffInvite(club, roles);
  revalidatePath("/coach/team");
}

export async function revokeStaffInvite(f: FormData) {
  const { club } = await requireAdmin();
  await revokeInvite(club, text(f, "token"));
  revalidatePath("/coach/team");
}

export async function removeStaffMember(f: FormData) {
  const { club } = await requireAdmin();
  await removeStaff(club, text(f, "id"));
  revalidatePath("/coach/team");
}

export async function rotateSquadLink() {
  const { club } = await requireAdmin();
  await squadInvite(club, true);
  revalidatePath("/coach/squad");
}

// The club admin deletes the whole club by typing its name. Wearable connections are closed first, then everything is removed.
export async function deleteWholeClub(f: FormData) {
  const { club, clubName } = await requireAdmin();
  if (text(f, "name").toLowerCase() !== clubName.toLowerCase()) redirect(`/coach/team?deleteerr=${encodeURIComponent("The name did not match, so nothing was deleted.")}`);
  for (const a of await listAthletes(club)) await deregister(a.code).catch(() => undefined);
  await deleteClub(club);
  await signOut();
  redirect("/signin?deleted=1");
}
