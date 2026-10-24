import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/actions/auth";
import { PendingButton } from "@/components/Pending";
import { SignoMark } from "@/components/SignoMark";
import { Card, Notice } from "@/components/ui";
import { getSession, homeFor } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function SignIn(props: PageProps<"/signin">) {
  const s = await getSession();
  if (s) redirect(homeFor(s));
  const { error, deleted } = await props.searchParams;
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">For club staff. Players use the link their club sent.</p>
      <Card className="mt-6 p-5">
        {deleted === "1" && <div className="mb-4"><Notice tone="ok">Your club and everything in it have been deleted.</Notice></div>}
        {typeof error === "string" && <div className="mb-4"><Notice tone="bad">{error}</Notice></div>}
        <form action={signIn}>
          <PendingButton className="signo-button w-full justify-center" pending="Opening signo…"><SignoMark />Sign in with signo</PendingButton>
        </form>
        <p className="mt-3 text-sm text-muted"><a href="https://usesigno.co.uk" className="underline underline-offset-4 hover:text-ink">signo</a> checks it is you with a passkey or an email it sends you, so there is no RepReady password.</p>
      </Card>
      <p className="mt-4 text-sm text-muted">New club? <Link href="/signup" className="font-medium text-ink underline underline-offset-4">Create a club account</Link>. Joining an existing club? Ask your club admin for a staff invite link.</p>
    </div>
  );
}
