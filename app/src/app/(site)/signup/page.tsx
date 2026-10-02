import Link from "next/link";
import { redirect } from "next/navigation";
import { signUp } from "@/actions/auth";
import { PendingButton } from "@/components/Pending";
import { btn, Card, input, Notice } from "@/components/ui";
import { getSession, homeFor, PASSWORD_MIN } from "@/lib/auth";

export const metadata = { title: "Create a club account" };

export default async function SignUp(props: PageProps<"/signup">) {
  const s = await getSession();
  if (s) redirect(homeFor(s));
  const { error } = await props.searchParams;
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">Create a club account</h1>
      <p className="mt-1 text-sm text-muted">You become the club admin. Next you add your squad and invite your staff.</p>
      <Card className="mt-6 p-5">
        {typeof error === "string" && <div className="mb-4"><Notice tone="bad">{error}</Notice></div>}
        <form action={signUp} className="space-y-3">
          <label htmlFor="club" className="block text-sm font-medium">Club name</label>
          <input id="club" name="club" required maxLength={80} className={input} autoFocus />
          <label htmlFor="name" className="block text-sm font-medium">Your name</label>
          <input id="name" name="name" autoComplete="name" required maxLength={80} className={input} />
          <label htmlFor="email" className="block text-sm font-medium">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={input} />
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} className={input} />
          <p className="text-xs text-muted">At least {PASSWORD_MIN} characters.</p>
          <PendingButton className={`${btn} w-full`} pending="Creating…">Create account</PendingButton>
        </form>
      </Card>
      <p className="mt-4 text-sm text-muted">Already have an account? <Link href="/signin" className="font-medium text-ink underline underline-offset-4">Sign in</Link>.</p>
    </div>
  );
}
