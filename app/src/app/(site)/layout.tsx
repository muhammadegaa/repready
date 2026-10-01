import { signOutAction, switchView } from "@/actions/auth";
import { Brand } from "@/components/Brand";
import { Nav } from "@/components/Nav";
import { getRole, sharedPasscode } from "@/lib/auth";

const LINKS = {
  coach: [{ href: "/coach", label: "Today" }, { href: "/coach/program", label: "Program" }],
  scientist: [{ href: "/science", label: "Rules" }, { href: "/science/evaluation", label: "Evaluation" }],
};

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between gap-4 border-b border-line py-3.5">
        <div className="flex items-center gap-6">
          <Brand href={role === "coach" ? "/coach" : role === "scientist" ? "/science" : "/"} />
          {role && <Nav links={LINKS[role]} />}
        </div>
        {role ? (
          <div className="flex items-center gap-2">
            {sharedPasscode() && (
              <form action={switchView}>
                <button className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink">{role === "coach" ? "Switch to scientist view" : "Switch to coach view"}</button>
              </form>
            )}
          <form action={signOutAction} className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:inline">{role === "coach" ? "Coach" : "Sports scientist"}</span>
            <button className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper">Sign out</button>
          </form>
          </div>
        ) : (
          <a href="/signin" className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper">Sign in</a>
        )}
      </header>
      <main className="flex-1 py-8">{children}</main>
      <footer className="border-t border-line py-6 text-xs text-muted">RepReady · Session adjustments for strength and conditioning coaches. Adults only. Not medical advice.</footer>
    </div>
  );
}
