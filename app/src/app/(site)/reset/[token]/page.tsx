import Link from "next/link";
import { setNewPassword } from "@/actions/auth";
import { PendingButton } from "@/components/Pending";
import { btn, Card, input, Notice } from "@/components/ui";
import { PASSWORD_MIN } from "@/lib/auth";
import { resetTokenUsable } from "@/lib/store";

export const metadata = { title: "Choose a new password" };

export default async function Reset(props: PageProps<"/reset/[token]">) {
  const { token } = await props.params;
  const { error } = await props.searchParams;
  const ok = await resetTokenUsable(token);
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <Card className="mt-6 space-y-4 p-5">
        {typeof error === "string" && <Notice tone="bad">{error}</Notice>}
        {ok ? (
          <form action={setNewPassword} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <label htmlFor="password" className="block text-sm font-medium">New password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required className={input} autoFocus />
            <p className="text-xs text-muted">At least {PASSWORD_MIN} characters.</p>
            <PendingButton className={`${btn} w-full`} pending="Saving…">Save and sign in</PendingButton>
          </form>
        ) : (
          <p className="text-sm">This reset link has expired or was already used. <Link href="/forgot" className="font-medium underline underline-offset-4">Ask for a new one</Link>.</p>
        )}
      </Card>
    </div>
  );
}
