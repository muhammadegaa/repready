import { resendVerification, signOutAction } from "@/actions/auth";
import { Brand } from "@/components/Brand";
import { Nav } from "@/components/Nav";
import { getSession, homeFor } from "@/lib/auth";
import { roleLabel } from "@/lib/copy";
import { requireEmailConfirmation } from "@/lib/mail";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const coach = Boolean(s?.access && s.roles.includes("coach"));
  const scientist = Boolean(s?.access && s.roles.includes("scientist"));
  // A coach sees three places and a menu. Someone who is only a scientist has no Today, so the science pages are their navigation.
  const links = !s ? [] : coach ? [{ href: "/coach", label: "Today" }, { href: "/coach/squad", label: "Squad" }, { href: "/coach/program", label: "Program" }] : scientist ? [{ href: "/science", label: "Rules" }, { href: "/science/evaluation", label: "Evaluation" }] : [];
  const more = !s || !coach ? [] : [
    { links: [{ href: "/coach/agent", label: "Agent" }, { href: "/coach/team", label: "Staff" }] },
    ...(scientist ? [{ title: "Science", links: [{ href: "/science", label: "Rules" }, { href: "/science/evaluation", label: "Evaluation" }] }] : []),
  ];
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6">
      {/* On a phone the tabs take their own row under the brand and Sign out, so nothing is pushed off the screen. */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line py-3.5">
        <Brand href={s ? homeFor(s) : "/"} />
        {s && <div className="order-3 w-full sm:order-none sm:w-auto"><Nav links={links} more={more} /></div>}
        {s ? (
          <form action={signOutAction} className="ml-auto flex items-center gap-3">
            <span className="text-right text-xs leading-tight text-muted">
              <span className="hidden font-medium text-ink sm:block">{s.clubName}</span>
              <span className="hidden sm:block">{s.name}</span>
              <span className="block font-medium text-brand-ink" data-testid="role">{s.admin ? "Admin · " : ""}{roleLabel(s.roles)}</span>
            </span>
            <button className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper">Sign out</button>
          </form>
        ) : (
          <a href="/signin" className="ml-auto rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper">Sign in</a>
        )}
      </header>
      {s && requireEmailConfirmation() && !s.verified && (
        <form action={resendVerification} className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warn/30 bg-warn-bg px-4 py-2 text-sm text-warn">
          <span>Confirm your email address ({s.email}) to receive the morning digest.</span>
          <button className="font-medium underline underline-offset-4">Send me the link</button>
        </form>
      )}
      <main className="flex-1 py-8">{children}</main>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-6 text-xs text-muted"><span>RepReady · Session adjustments for football performance staff. Players 18 and over. Not medical advice.</span><a href="/trust" className="underline underline-offset-4 hover:text-ink">What it does and never does</a></footer>
    </div>
  );
}
