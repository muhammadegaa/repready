import { signOutAction } from "@/actions/auth";
import { Brand } from "@/components/Brand";
import { Nav } from "@/components/Nav";
import { getSession, homeFor } from "@/lib/auth";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const links = s
    ? [
        ...(s.roles.includes("coach") ? [{ href: "/coach", label: "Today" }, { href: "/coach/squad", label: "Squad" }, { href: "/coach/team", label: "Staff" }, { href: "/coach/program", label: "Program" }] : []),
        ...(s.roles.includes("scientist") ? [{ href: "/science", label: "Rules" }, { href: "/science/evaluation", label: "Evaluation" }] : []),
      ]
    : [];
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between gap-4 border-b border-line py-3.5">
        <div className="flex items-center gap-6">
          <Brand href={s ? homeFor(s) : "/"} />
          {s && <Nav links={links} />}
        </div>
        {s ? (
          <form action={signOutAction} className="flex items-center gap-3">
            <span className="hidden text-right text-xs leading-tight text-muted sm:block">
              <span className="block font-medium text-ink">{s.clubName}</span>
              {s.name}
            </span>
            <button className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper">Sign out</button>
          </form>
        ) : (
          <a href="/signin" className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper">Sign in</a>
        )}
      </header>
      <main className="flex-1 py-8">{children}</main>
      <footer className="border-t border-line py-6 text-xs text-muted">RepReady · Session adjustments for football performance staff. Players 18 and over. Not medical advice.</footer>
    </div>
  );
}
