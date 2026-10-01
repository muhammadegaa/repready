"use client";

import { useActionState } from "react";
import { joinWaitlist } from "@/actions/public";
import { PendingButton } from "./Pending";
import { btn } from "./ui";

export function LeadForm({ id, cta = "Get early access" }: { id: string; cta?: string }) {
  const [state, action] = useActionState(joinWaitlist, null);
  if (state?.ok) {
    return <p className="rounded-lg border border-ok/30 bg-ok-bg px-4 py-3 text-sm font-medium text-ok" role="status">{state.message}</p>;
  }
  return (
    <form action={action} className="space-y-2" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`email-${id}`} className="sr-only">Email</label>
        <input
          id={`email-${id}`} name="email" type="email" inputMode="email" autoComplete="email" required placeholder="you@club.com"
          className="w-full min-w-0 rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] placeholder:text-muted sm:max-w-xs"
        />
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <PendingButton className={`${btn} whitespace-nowrap px-5 py-2.5 text-[15px]`} pending="Adding you…">{cta}</PendingButton>
      </div>
      {state && !state.ok && <p className="text-sm text-bad" role="alert">{state.message}</p>}
    </form>
  );
}
