"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { askAction, confirmAskAction } from "@/actions/ask";
import type { Reply } from "@/lib/ask/respond";
import { COMMANDS } from "@/lib/ask/understand";
import { CopyButton } from "./CopyButton";
import { btn, btnGhost, Card } from "./ui";

// One place to say what you want. A sentence is read by the assistant; the buttons skip it. Anything that would change something
// comes back as a preview first, and nothing is saved until the coach confirms.
export function AskBar() {
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, start] = useTransition();
  const field = useRef<HTMLInputElement>(null);

  const send = (f: FormData) =>
    start(async () => {
      setReply(await askAction(null, f));
      if (!f.get("direct") && field.current) field.current.value = "";
    });
  const confirm = (action: unknown) =>
    start(async () => {
      const f = new FormData();
      f.set("action", JSON.stringify(action));
      setReply(await confirmAskAction(null, f));
    });

  return (
    <section aria-label="Ask" className="space-y-3">
      <form action={send} className="flex flex-wrap items-center gap-2">
        <label htmlFor="ask-q" className="sr-only">What do you want to do?</label>
        <input
          id="ask-q" ref={field} name="q" maxLength={500} autoComplete="off" disabled={busy}
          placeholder="Ask or tell me: “Mensah 90, Ortiz 60 yesterday”"
          className="min-w-0 flex-1 basis-72 rounded-md border border-line-strong bg-surface px-3 py-2.5 text-sm placeholder:text-muted"
        />
        <button className={btn} disabled={busy}>{busy ? "Working…" : "Ask"}</button>
        <div className="flex w-full flex-wrap gap-2">
          {COMMANDS.map((c) => <button key={c.intent} name="direct" value={c.intent} disabled={busy} className={`${btnGhost} px-3 py-1 text-xs`}>{c.label}</button>)}
        </div>
      </form>
      <p className="text-xs text-muted">Player names are replaced by codes before the assistant reads your sentence. Leave out health details; nothing changes until you confirm.</p>

      {reply && (
        <div role="status" aria-live="polite"><Card className="reveal space-y-3 p-4">
          {reply.kind === "error" && <p className="text-sm text-bad">{reply.message}</p>}
          {reply.kind === "done" && <p className="text-sm text-ok">{reply.message}</p>}
          {(reply.kind === "answer" || reply.kind === "confirm") && (
            <>
              <h3 className="font-semibold">{reply.title}</h3>
              <ul className="space-y-1 text-sm">{reply.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </>
          )}
          {reply.kind === "answer" && reply.reminders && (
            <div className="flex flex-wrap gap-2">
              {reply.reminders.map((r) => <CopyButton key={r.code} path={`/a/${r.code}`} label={`Copy reminder for ${r.name.split(" ")[0]}`} message={r.message} className={`${btnGhost} px-3 py-1 text-xs`} />)}
            </div>
          )}
          {reply.kind === "answer" && reply.links && (
            <div className="flex flex-wrap gap-3 text-sm">{reply.links.map((l) => <Link key={l.href} href={l.href} className="font-medium underline underline-offset-4">{l.label}</Link>)}</div>
          )}
          {reply.kind === "confirm" && (
            <div className="flex items-center gap-3">
              <button className={btn} disabled={busy} onClick={() => confirm(reply.action)}>{busy ? "Saving…" : "Confirm"}</button>
              <button className="text-sm text-muted underline underline-offset-4" disabled={busy} onClick={() => setReply(null)}>Cancel</button>
            </div>
          )}
          {reply.kind !== "confirm" && <button className="text-xs text-muted underline underline-offset-4" onClick={() => setReply(null)}>Dismiss</button>}
        </Card></div>
      )}
    </section>
  );
}
