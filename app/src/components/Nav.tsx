"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1" aria-label="Main">
      {links.map((l) => {
        const active = l.href === "/coach" || l.href === "/science" ? path === l.href : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
