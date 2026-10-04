import { describe, expect, it } from "vitest";
import { capture, type CaptureMeta } from "./capture";
import { film, LEAD } from "./synthetic";
import { bones, interpolate } from "./pose";
import { JOINTS, type Movement } from "./types";
import { MOVEMENTS } from "./index";

const baseMeta = (m: Movement, scene: CaptureMeta["scene"]): CaptureMeta => ({
  id: m.id, name: m.name, names: m.names, cues: m.cues, scene,
  phases: m.phases.map((p) => ({ label: p.label, from: p.from })),
});

// The arms of the hand-placed Nordic are squashed against the floor, which a body with fixed bone lengths cannot copy, so they are not compared.
const meanErr = (got: Movement, want: Movement, skip: string[] = []) => {
  const errs: number[] = [];
  for (let n = 0; n <= 20; n++) {
    const a = interpolate(got.keyframes, n / 20), b = interpolate(want.keyframes, n / 20);
    for (const j of JOINTS.filter((x) => !skip.includes(x))) errs.push(Math.hypot(a[j][0] - b[j][0], a[j][1] - b[j][1]));
  }
  return { mean: errs.reduce((x, y) => x + y, 0) / errs.length, max: Math.max(...errs) };
};

const SCENES = { "box-jump": "box-final", "drop-jump": "box-initial", "nordic-hamstring-curl": "pad" } as const;

describe("capturing a filmed rep", () => {
  it.each(MOVEMENTS.map((m) => [m.id, m] as const))("%s: a filmed rep comes back as the same movement, with the scene found", (id, m) => {
    const meta = { ...baseMeta(m, SCENES[id as keyof typeof SCENES]), startS: LEAD, endS: LEAD + 1.6 };
    const r = capture(film(m), meta);
    const e = meanErr(r.movement, m, id === "nordic-hamstring-curl" ? ["elbow", "wrist"] : []);
    expect(e.mean, "mean joint error").toBeLessThan(7);
    expect(e.max, "worst joint error").toBeLessThan(20);
    expect(r.movement.keyframes[0].t).toBe(0);
    expect(r.movement.keyframes[r.movement.keyframes.length - 1].t).toBe(1);
    expect(r.movement.keyframes.length).toBeLessThanOrEqual(10);
    expect(r.movement.source).toBe("captured");
    expect(r.movement.reviewed).toBe(false);
    if (m.scene.box) { expect(r.movement.scene.box).toBeDefined(); expect(Math.abs(r.movement.scene.box!.y - m.scene.box.y)).toBeLessThan(10); expect(Math.abs(r.movement.scene.box!.x - m.scene.box.x)).toBeLessThan(30); }
    if (m.scene.pad) { expect(r.movement.scene.pad).toBeDefined(); expect(Math.abs(r.movement.scene.pad!.x - m.scene.pad.x)).toBeLessThan(30); }
    expect(r.warnings.filter((w) => !/phases|keyframes follow/.test(w))).toEqual([]);
  });

  it("gives a figure whose bones keep their length and stay inside the scene", () => {
    const m = MOVEMENTS.find((x) => x.id === "box-jump")!;
    const r = capture(film(m, { noise: 1.5 }), { ...baseMeta(m, "box-final"), startS: LEAD, endS: LEAD + 1.6 });
    const all = r.movement.keyframes.map((k) => bones(k.pose));
    for (const b of ["torso", "thigh", "shin"] as const) {
      const v = all.map((x) => x[b]); const med = [...v].sort((a, c) => a - c)[Math.floor(v.length / 2)];
      for (const x of v) expect(Math.abs(x - med) / med).toBeLessThan(0.05);
    }
    for (const k of r.movement.keyframes) for (const j of JOINTS) { expect(k.pose[j][0]).toBeGreaterThan(0); expect(k.pose[j][0]).toBeLessThan(420); expect(k.pose[j][1]).toBeGreaterThan(0); expect(k.pose[j][1]).toBeLessThan(340); }
  });

  it("reads a clip filmed from the other side, moving the other way", () => {
    const m = MOVEMENTS.find((x) => x.id === "box-jump")!;
    const r = capture(film(m, { mirror: true, side: "right" }), { ...baseMeta(m, "box-final"), startS: LEAD, endS: LEAD + 1.6 });
    expect(r.report.mirrored).toBe(true);
    expect(r.report.side).toBe("right");
    expect(meanErr(r.movement, m).mean).toBeLessThan(7);
  });

  it("finds the moving part of a clip on its own", () => {
    const m = MOVEMENTS.find((x) => x.id === "drop-jump")!;
    const r = capture(film(m, { lead: 1.2 }), baseMeta(m, "box-initial"));
    expect(r.report.startS).toBeGreaterThan(0.6);
    expect(r.report.startS).toBeLessThan(1.5);
    expect(r.report.endS).toBeGreaterThan(1.2 + 1.6 - 0.4);
    expect(r.report.endS).toBeLessThan(1.2 + 1.6 + 0.8);
  });

  it("makes the figure last twice the real time, within limits, unless told", () => {
    const m = MOVEMENTS.find((x) => x.id === "box-jump")!;
    const meta = { ...baseMeta(m, "box-final"), startS: LEAD, endS: LEAD + 1.6 };
    expect(capture(film(m), meta).movement.durationMs).toBe(3200);
    expect(capture(film(m), { ...meta, durationMs: 4500 }).movement.durationMs).toBe(4500);
  });

  it("warns when the camera is not side-on, when the detector is unsure, and when the body leaves the picture", () => {
    const m = MOVEMENTS.find((x) => x.id === "box-jump")!;
    const meta = { ...baseMeta(m, "box-final"), startS: LEAD, endS: LEAD + 1.6 };
    expect(capture(film(m, { shoulderGap: 130 }), meta).warnings.join(" ")).toMatch(/side-on/);
    expect(capture(film(m, { vis: 0.55 }), meta).warnings.join(" ")).toMatch(/unsure/);
    const cut = film(m, { ox: -430 }); // the person starts left of the picture
    expect(capture(cut, meta).warnings.join(" ")).toMatch(/edge of the picture|only/);
  });

  it("warns when nobody was found, and refuses a clip that is too short to read", () => {
    const m = MOVEMENTS.find((x) => x.id === "box-jump")!;
    const meta = { ...baseMeta(m, "box-final"), startS: LEAD, endS: LEAD + 1.6 };
    const src = film(m);
    const empty = { ...src, frames: src.frames.map((f, i) => (i % 3 ? { ...f, lm: null } : f)) };
    expect(capture(empty, meta).warnings.join(" ")).toMatch(/only \d+ of \d+ frames/);
    expect(() => capture({ ...src, frames: src.frames.slice(0, 5) }, meta)).toThrow(/too few frames/);
  });

  it("says so when a box was asked for but none is there", () => {
    const m = MOVEMENTS.find((x) => x.id === "nordic-hamstring-curl")!;
    const r = capture(film(m), { ...baseMeta(m, "box-final"), startS: LEAD, endS: LEAD + 1.6 });
    expect(r.warnings.join(" ")).toMatch(/no box was found/);
    expect(r.movement.scene.box).toBeUndefined();
  });
});
