import { redirect } from "next/navigation";
import { signIn } from "@/actions/auth";
import { PendingButton } from "@/components/Pending";
import { btn, Card, input, Notice } from "@/components/ui";
import { getRole, roleEnabled } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function SignIn(props: PageProps<"/signin">) {
  const role = await getRole();
  if (role) redirect(role === "coach" ? "/coach" : "/science");
  const { error } = await props.searchParams;
  const enabled = roleEnabled("coach") || roleEnabled("scientist");
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Choose your view and enter its passcode. Players use the link their club sent.</p>
      <Card className="mt-6 p-5">
        {!enabled && <Notice>No passcode is configured. Set COACH_PASSCODE (and SCIENTIST_PASSCODE) and restart.</Notice>}
        {error && <div className="mb-4"><Notice tone="bad">That passcode did not match.</Notice></div>}
        <form action={signIn} className="space-y-3">
          <fieldset className="flex gap-4 text-sm">
            <legend className="sr-only">View</legend>
            <label className="flex items-center gap-2"><input type="radio" name="view" value="coach" defaultChecked />Coach</label>
            <label className="flex items-center gap-2"><input type="radio" name="view" value="scientist" />Sports scientist</label>
          </fieldset>
          <label htmlFor="passcode" className="block text-sm font-medium">Passcode</label>
          <input id="passcode" name="passcode" type="password" autoComplete="current-password" required className={input} autoFocus />
          <PendingButton className={`${btn} w-full`} pending="Checking…">Continue</PendingButton>
        </form>
      </Card>
    </div>
  );
}
