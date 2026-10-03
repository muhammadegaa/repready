"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { finishEvalRun, runScenario } from "@/actions/science";
import type { EvalResult } from "@/lib/store";
import { btn } from "./ui";

const POOL = 3;

export function EvalRunner({ ids, disabledReason }: { ids: string[]; disabledReason?: string }) {
  const router = useRouter();
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setDone(0);
    const results: EvalResult[] = [];
    const queue = [...ids];
    try {
      await Promise.all(
        Array.from({ length: POOL }, async () => {
          for (let id = queue.shift(); id; id = queue.shift()) {
            results.push(await runScenario(id));
            setDone((n) => n + 1);
          }
        }),
      );
      results.sort((a, b) => a.id.localeCompare(b.id));
      await finishEvalRun(results);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <button className={btn} onClick={run} disabled={running || ids.length === 0}>
          {running ? `Running ${done} of ${ids.length}…` : `Run evaluation on ${ids.length} labeled scenario${ids.length === 1 ? "" : "s"}`}
        </button>
        {disabledReason && ids.length === 0 && <span className="text-sm text-muted">{disabledReason}</span>}
      </div>
      {running && (
        <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={done} aria-valuemax={ids.length}>
          <div className="h-full bg-brand transition-all" style={{ width: `${(done / Math.max(ids.length, 1)) * 100}%` }} />
        </div>
      )}
      {error && <p className="text-sm text-bad">The run stopped: {error}</p>}
    </div>
  );
}
