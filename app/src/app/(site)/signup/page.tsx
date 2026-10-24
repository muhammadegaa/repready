import Link from "next/link";
import { redirect } from "next/navigation";
import { signUp } from "@/actions/auth";
import { PendingButton } from "@/components/Pending";
import { SignoMark } from "@/components/SignoMark";
import { Card, input, Notice } from "@/components/ui";
import { getSession, homeFor } from "@/lib/auth";

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
          <PendingButton className="signo-button w-full justify-center" pending="Opening signo…"><SignoMark />Continue with signo</PendingButton>
        </form>
        <p className="mt-3 text-sm text-muted">signo confirms your work email with a passkey or an email it sends you. That email is your account.</p>
      </Card>
      <p className="mt-4 text-sm text-muted">Already have an account? <Link href="/signin" className="font-medium text-ink underline underline-offset-4">Sign in</Link>.</p>
    </div>
  );
}
