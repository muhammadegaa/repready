import { describe, expect, it } from "vitest";
import { BODY, bones, interpolate, phaseAt } from "./pose";
import { MOVEMENTS, movementFor } from "./index";
import { JOINTS } from "./types";

describe("movement data", () => {
  it("has the three first exercises, each with a unique id", () => {
    expect(MOVEMENTS.map((m) => m.id)).toEqual(expect.arrayContaining(["box-jump", "drop-jump", "nordic-hamstring-curl"]));
    expect(new Set(MOVEMENTS.map((m) => m.id)).size).toBe(MOVEMENTS.length);
  });

  it.each(MOVEMENTS.map((m) => [m.id, m] as const))("%s: keyframes run from 0 to 1 in order, every joint is a finite point inside the scene", (_id, m) => {
    expect(m.keyframes[0].t).toBe(0);
    expect(m.keyframes[m.keyframes.length - 1].t).toBe(1);
    m.keyframes.forEach((k, i) => {
      if (i > 0) expect(k.t).toBeGreaterThanOrEqual(m.keyframes[i - 1].t);
      for (const j of JOINTS) {
        const [x, y] = k.pose[j];
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(m.scene.width);
        expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(m.scene.height);
      }
    });
  });

  it.each(MOVEMENTS.map((m) => [m.id, m] as const))("%s: the phases cover the whole movement without gaps, and there are cues", (_id, m) => {
    expect(m.phases[0].from).toBe(0);
    expect(m.phases[m.phases.length - 1].to).toBe(1);
    m.phases.forEach((p, i) => { if (i > 0) expect(p.from).toBe(m.phases[i - 1].to); });
    expect(m.cues.length).toBeGreaterThanOrEqual(2);
    expect(m.reviewed).toBe(false); // until a sports scientist signs it off, and this test is changed with that decision
  });

  it.each(MOVEMENTS.map((m) => [m.id, m] as const))("%s: the figure's bones keep their length between poses (within 5%)", (_id, m) => {
    const all = m.keyframes.map((k) => bones(k.pose));
    for (const b of ["torso", "thigh", "shin"] as const) {
      const vals = all.map((x) => x[b]).sort((a, c) => a - c);
      const median = vals[Math.floor(vals.length / 2)];
      for (const v of vals) expect(Math.abs(v - median) / median, `${b} ${v.toFixed(0)} vs ${median.toFixed(0)}`).toBeLessThan(0.05);
    }
  });
});

describe("interpolation", () => {
  const m = MOVEMENTS.find((x) => x.id === "box-jump")!;
  const near = (a: [number, number], b: [number, number], d = 0.6) => Math.hypot(a[0] - b[0], a[1] - b[1]) < d;

  it("returns a keyframe's own pose at its time and holds the ends", () => {
    for (const k of m.keyframes) { const p = interpolate(m.keyframes, k.t); for (const j of JOINTS) expect(near(p[j], k.pose[j]), `${j} at ${k.t}`).toBe(true); }
    const start = interpolate(m.keyframes, -1);
    for (const j of JOINTS) expect(near(start[j], m.keyframes[0].pose[j])).toBe(true);
    expect(interpolate(m.keyframes, 5)).toEqual(m.keyframes[m.keyframes.length - 1].pose);
  });

  it("moves smoothly: no joint jumps between neighbouring instants", () => {
    for (const mv of MOVEMENTS) {
      let prev = interpolate(mv.keyframes, 0);
      for (let t = 0.004; t <= 1; t += 0.004) {
        const p = interpolate(mv.keyframes, t);
        // Fast, not instant: a joint may travel up to 1,200 scene units a second at the speed the figure plays, and no more.
        const limit = 1200 * 0.004 * (mv.durationMs / 1000);
        for (const j of JOINTS) expect(Math.hypot(p[j][0] - prev[j][0], p[j][1] - prev[j][1]), `${mv.id} ${j} at ${t.toFixed(3)}`).toBeLessThan(limit);
        prev = p;
      }
    }
  });

  it("keeps the bones their true length at every instant, not only at keyframes", () => {
    for (const mv of MOVEMENTS) for (let t = 0; t <= 1; t += 0.023) {
      const b = bones(interpolate(mv.keyframes, t));
      expect(Math.abs(b.torso - BODY.torso)).toBeLessThan(0.6);
      expect(Math.abs(b.thigh - BODY.thigh)).toBeLessThan(0.6);
      expect(Math.abs(b.shin - BODY.shin)).toBeLessThan(0.6);
    }
  });

  it("does not overshoot the poses it passes through", () => {
    for (const mv of MOVEMENTS) {
      const lo = (j: (typeof JOINTS)[number], c: 0 | 1) => Math.min(...mv.keyframes.map((k) => k.pose[j][c]));
      const hi = (j: (typeof JOINTS)[number], c: 0 | 1) => Math.max(...mv.keyframes.map((k) => k.pose[j][c]));
      for (let t = 0; t <= 1; t += 0.02) {
        const p = interpolate(mv.keyframes, t);
        for (const j of ["hip", "neck", "head"] as const) for (const c of [0, 1] as const) { expect(p[j][c]).toBeGreaterThan(lo(j, c) - 6); expect(p[j][c]).toBeLessThan(hi(j, c) + 6); }
      }
    }
  });

  it("keeps a planted foot where it is between two planted keyframes", () => {
    const stand = { hip: [100, 205], knee: [100, 253], ankle: [100, 300], toe: [117, 300], neck: [100, 143], head: [100, 121], elbow: [96, 170], wrist: [96, 200] } as never;
    const squat = { hip: [88, 232], knee: [124, 258], ankle: [100, 300], toe: [117, 300], neck: [124, 182], head: [136, 164], elbow: [110, 206], wrist: [100, 228] } as never;
    const kf = [{ t: 0, pose: stand, contact: true }, { t: 1, pose: squat, contact: true }];
    for (const t of [0.2, 0.5, 0.8]) { const p = interpolate(kf, t); expect(Math.hypot(p.ankle[0] - 100, p.ankle[1] - 300)).toBeLessThan(0.6); }
  });

  it("names the phase at a time", () => {
    expect(phaseAt(m.phases, 0)).toBe("Load");
    expect(phaseAt(m.phases, 0.3)).toBe("Jump");
    expect(phaseAt(m.phases, 1)).toBe("Stand tall");
  });
});

describe("which exercise gets a figure", () => {
  it("finds the exercise as a coach writes it", () => {
    expect(movementFor("Box jump")?.id).toBe("box-jump");
    expect(movementFor("box jumps")?.id).toBe("box-jump");
    expect(movementFor("Drop jump")?.id).toBe("drop-jump");
    expect(movementFor("depth jump")?.id).toBe("drop-jump");
    expect(movementFor("Nordic hamstring curl")?.id).toBe("nordic-hamstring-curl");
    expect(movementFor("nordics")?.id).toBe("nordic-hamstring-curl");
  });
  it("gives nothing for other exercises, and never guesses from a near miss", () => {
    expect(movementFor("Back squat")).toBeNull();
    expect(movementFor("Box jump to a higher box")).toBeNull();
    expect(movementFor("")).toBeNull();
  });
});
