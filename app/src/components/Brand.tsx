import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight">
      <span className="inline-block h-3.5 w-3.5 rounded-[3px] bg-marker ring-1 ring-ink/80" aria-hidden />
      RepReady
    </Link>
  );
}
