import { describe, expect, it } from "vitest";
import { bones, interpolate, phaseAt } from "./pose";
import { MOVEMENTS, movementFor } from "./index";
import { JOINTS } from "./types";

describe("movement data", () => {
  it("has the three exercises, each with a unique id", () => {
    expect(MOVEMENTS.map((m) => m.id).sort()).toEqual(["box-jump", "drop-jump", "nordic-hamstring-curl"]);
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
  it("returns a keyframe's own pose at its time and holds the ends", () => {
    expect(interpolate(m.keyframes, 0)).toEqual(m.keyframes[0].pose);
    expect(interpolate(m.keyframes, m.keyframes[2].t)).toEqual(m.keyframes[2].pose);
    expect(interpolate(m.keyframes, -1)).toEqual(m.keyframes[0].pose);
    expect(interpolate(m.keyframes, 5)).toEqual(m.keyframes[m.keyframes.length - 1].pose);
  });
  it("is halfway between two keyframes at the middle of their span, whatever the easing", () => {
    const a = m.keyframes[1], b = m.keyframes[2];
    const p = interpolate(m.keyframes, (a.t + b.t) / 2);
    expect(p.hip[0]).toBeCloseTo((a.pose.hip[0] + b.pose.hip[0]) / 2, 5);
    expect(p.hip[1]).toBeCloseTo((a.pose.hip[1] + b.pose.hip[1]) / 2, 5);
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
