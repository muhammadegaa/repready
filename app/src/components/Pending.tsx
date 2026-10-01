"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

// Submit button that shows work in progress; formAction lets one form hold several actions.
export function PendingButton({
  children, pending = "Working…", className, formAction, name, value,
}: {
  children: ReactNode;
  pending?: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
}) {
  const { pending: busy } = useFormStatus();
  return (
    <button className={className} disabled={busy} formAction={formAction} name={name} value={value}>
      {busy ? pending : children}
    </button>
  );
}
