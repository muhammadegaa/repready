import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/actions/auth";
import { PendingButton } from "@/components/Pending";
import { btn, Card, input, Notice } from "@/components/ui";
import { getSession, homeFor } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function SignIn(props: PageProps<"/signin">) {
  const s = await getSession();
  if (s) redirect(homeFor(s));
  const { error } = await props.searchParams;
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">For club staff. Players use the link their club sent.</p>
      <Card className="mt-6 p-5">
        {typeof error === "string" && <div className="mb-4"><Notice tone="bad">{error}</Notice></div>}
        <form action={signIn} className="space-y-3">
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={input} autoFocus />
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={input} />
          <PendingButton className={`${btn} w-full`} pending="Checking…">Sign in</PendingButton>
        </form>
        <p className="mt-3 text-sm"><Link href="/forgot" className="text-muted underline underline-offset-4 hover:text-ink">Forgot your password?</Link></p>
      </Card>
      <p className="mt-4 text-sm text-muted">New club? <Link href="/signup" className="font-medium text-ink underline underline-offset-4">Create a club account</Link>. Joining an existing club? Ask your club admin for a staff invite link.</p>
    </div>
  );
}
