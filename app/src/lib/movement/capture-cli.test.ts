import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MOVEMENTS } from "./index";
import { film, LEAD } from "./synthetic";
import type { Movement } from "./types";

// Runs the real command on a synthetic filmed rep, the way the wrapper does after the detector has finished.
describe("scripts/capture-movement.mts", () => {
  it("reads landmarks and a meta file, and writes the movement and a review page", () => {
    const m = MOVEMENTS.find((x) => x.id === "box-jump")!;
    const dir = mkdtempSync(join(tmpdir(), "capture-"));
    mkdirSync(join(dir, "frames"));
    writeFileSync(join(dir, "landmarks.json"), JSON.stringify({ ...film(m), thumbEvery: 3 }));
    const meta = { id: m.id, name: m.name, names: m.names, cues: m.cues, scene: "box-final", phases: m.phases.map((p) => ({ label: p.label, from: p.from })), startS: LEAD, endS: LEAD + 1.6 };
    writeFileSync(join(dir, "meta.json"), JSON.stringify(meta));

    const out = execFileSync("npx", ["tsx", "scripts/capture-movement.mts", dir, join(dir, "meta.json")], { encoding: "utf8", timeout: 60_000 });
    expect(out).toMatch(/Box jump: \d+ keyframes/);
    expect(out).toMatch(/Not saved/); // without --write nothing reaches the repo

    const made = JSON.parse(readFileSync(join(dir, "movement.json"), "utf8")) as Movement;
    expect(made.id).toBe("box-jump");
    expect(made.source).toBe("captured");
    expect(made.reviewed).toBe(false);
    expect(made.keyframes.length).toBeGreaterThanOrEqual(4);
    expect(made.scene.box).toBeDefined();

    const html = readFileSync(join(dir, "review.html"), "utf8");
    expect(html).toContain("<h1>Box jump</h1>");
    expect(html).toContain("not reviewed");
    expect(html).toContain("Hip height over the movement");
    expect((html.match(/class="card"/g) ?? []).length).toBe(made.keyframes.length); // one card per keyframe
    for (const p of m.phases) expect(html).toContain(p.label);
  }, 90_000);

  it("stops with a clear message when the arguments are missing", () => {
    expect(() => execFileSync("npx", ["tsx", "scripts/capture-movement.mts"], { encoding: "utf8", stdio: "pipe", timeout: 60_000 })).toThrow(/Usage/);
  }, 90_000);
});
