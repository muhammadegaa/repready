"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createStaffInvite, removeStaff, revokeInvite, squadInvite, type StaffRole } from "@/lib/store";

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
