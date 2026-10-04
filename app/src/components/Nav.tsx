"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavLink = { href: string; label: string };
type Group = { title?: string; links: NavLink[] };

// A few places you go on purpose, and one menu for everything you set up once or look at now and then.
export function Nav({ links, more = [] }: { links: NavLink[]; more?: Group[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const isActive = (href: string) => (href === "/coach" || href === "/science" ? path === href : path.startsWith(href));
  const moreActive = more.some((g) => g.links.some((l) => isActive(l.href)));

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const pill = (active: boolean) => `rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? "bg-brand-soft text-brand-ink" : "text-muted hover:bg-brand-soft/60 hover:text-ink"}`;

  return (
    <nav className="flex items-center gap-1" aria-label="Main">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className={pill(isActive(l.href))}>{l.label}</Link>
      ))}
      {more.length > 0 && (
        <div ref={box} className="relative">
          <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${pill(moreActive)} inline-flex items-center gap-1`}>
            More <span aria-hidden className="text-[10px]">▾</span>
          </button>
          {open && (
            <div role="menu" className="absolute left-0 top-full z-20 mt-2 min-w-52 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
              {more.map((g, i) => (
                <div key={g.title ?? i} className={i ? "mt-1 border-t border-line pt-1" : ""}>
                  {g.title && <div className="px-3 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{g.title}</div>}
                  {g.links.map((l) => (
                    <Link key={l.href} role="menuitem" onClick={() => setOpen(false)} href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className={`block rounded-md px-3 py-2 text-sm ${isActive(l.href) ? "bg-brand-soft font-medium text-brand-ink" : "hover:bg-paper"}`}>{l.label}</Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
