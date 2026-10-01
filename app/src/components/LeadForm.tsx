"use client";

import { useActionState } from "react";
import { requestPilot } from "@/actions/public";
import { PendingButton } from "./Pending";
import { btn } from "./ui";

const field = "w-full min-w-0 rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] placeholder:text-muted";

export function LeadForm({ id }: { id: string }) {
  const [state, action] = useActionState(requestPilot, null);
  if (state?.ok) {
    return <p className="rounded-lg border border-ok/30 bg-ok-bg px-4 py-3 text-sm font-medium text-ok" role="status">{state.message}</p>;
  }
  return (
    <form action={action} className="space-y-2" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`club-${id}`} className="sr-only">Club</label>
        <input id={`club-${id}`} name="club" autoComplete="organization" placeholder="Club" maxLength={80} className={`${field} sm:max-w-[11rem]`} />
        <label htmlFor={`email-${id}`} className="sr-only">Work email</label>
        <input id={`email-${id}`} name="email" type="email" inputMode="email" autoComplete="email" required placeholder="Work email" className={`${field} sm:max-w-[15rem]`} />
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <PendingButton className={`${btn} whitespace-nowrap px-5 py-2.5 text-[15px]`} pending="Sending…">Request a pilot</PendingButton>
      </div>
      {state && !state.ok && <p className="text-sm text-bad" role="alert">{state.message}</p>}
    </form>
  );
}
