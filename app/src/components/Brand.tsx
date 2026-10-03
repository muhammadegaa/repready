import Link from "next/link";

// The mark: a tick ("ready") on brand blue, with the yellow highlighter dot that the product uses wherever a value was changed.
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <rect width="24" height="24" rx="6.5" fill="var(--brand)" />
      <path d="M6.2 12.6l3.9 3.9 7.7-9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.6" cy="5.6" r="2.3" fill="var(--marker)" />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-[16px] font-semibold tracking-tight">
      <BrandMark />
      RepReady
    </Link>
  );
}
