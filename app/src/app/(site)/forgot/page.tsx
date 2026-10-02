import Link from "next/link";
import { requestReset } from "@/actions/auth";
import { PendingButton } from "@/components/Pending";
import { btn, Card, input, Notice } from "@/components/ui";

export const metadata = { title: "Reset password" };

export default async function Forgot(props: PageProps<"/forgot">) {
  const { sent, error } = await props.searchParams;
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <Card className="mt-6 space-y-4 p-5">
        {typeof error === "string" && <Notice tone="bad">{error}</Notice>}
        {sent ? (
          <Notice>If that email has an account, a reset link is on its way. It works once and expires in an hour.</Notice>
        ) : (
          <form action={requestReset} className="space-y-3">
            <label htmlFor="email" className="block text-sm font-medium">Your email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className={input} autoFocus />
            <PendingButton className={`${btn} w-full`} pending="Sending…">Email me a reset link</PendingButton>
          </form>
        )}
      </Card>
      <p className="mt-4 text-sm text-muted"><Link href="/signin" className="underline underline-offset-4">Back to sign in</Link></p>
    </div>
  );
}
