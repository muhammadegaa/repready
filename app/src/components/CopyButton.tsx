"use client";

import { useState } from "react";

export function CopyButton({ path, className, label = "Copy link" }: { path: string; className?: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        try {
          await navigator.clipboard.writeText(url);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt("Copy this link", url);
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
