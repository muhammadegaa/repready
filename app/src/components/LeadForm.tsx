"use client";

import { useActionState } from "react";
import { requestPilot } from "@/actions/public";
import { PendingButton } from "./Pending";

// One field and one button. The club is asked about when we reply.
export function LeadForm({ id }: { id: string }) {
  const [state, action] = useActionState(requestPilot, null);
  if (state?.ok) {
    return <p className="rounded-xl border border-ok/30 bg-ok-bg px-4 py-3 text-sm font-medium text-ok" role="status">{state.message}</p>;
  }
  return (
    <form action={action} className="w-full max-w-[520px] space-y-2" noValidate>
      <div className="pill-field flex flex-col gap-1.5 rounded-[14px] border border-line-strong bg-surface p-1.5 sm:flex-row">
        <label htmlFor={`email-${id}`} className="sr-only">Work email</label>
        <input id={`email-${id}`} name="email" type="email" inputMode="email" autoComplete="email" required placeholder="Work email" className="h-11 min-w-0 flex-1 bg-transparent px-3.5 text-base outline-none placeholder:text-muted" />
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <PendingButton className="press h-12 whitespace-nowrap rounded-[10px] bg-brand px-6 text-[15px] font-semibold text-on-brand focus-visible:outline-offset-2" pending="Sending…">Request a pilot</PendingButton>
      </div>
      {state && !state.ok && <p className="text-sm text-bad" role="alert">{state.message}</p>}
    </form>
  );
}
