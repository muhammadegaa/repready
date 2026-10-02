"use client";

import { useState } from "react";

// `message` may contain {url}, which becomes the full link. Without it the link itself is copied.
export function CopyButton({ path, className, label = "Copy link", message }: { path: string; className?: string; label?: string; message?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const link = `${window.location.origin}${path}`;
        const url = message ? message.replace("{url}", link) : link;
        try {
          await navigator.clipboard.writeText(url);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt("Copy this", url);
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
