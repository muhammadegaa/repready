import { interpolate } from "./pose";
import { JOINTS, type Movement } from "./types";
import type { Landmark, Source } from "./capture";

// Test support: what a detector would see if a person did a movement in front of a camera. Not used by the app.
export const W = 1280, H = 720, FPS = 30, PX = 1.9; // image pixels per scene unit
export const LEAD = 0.5, TAIL = 0.6;

// A seeded gaussian, so the noise is the same every run.
function rng(seed: number) {
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return () => Math.sqrt(-2 * Math.log(u() || 1e-9)) * Math.cos(2 * Math.PI * u());
}

const IDX = { left: { hip: 23, knee: 25, ankle: 27, toe: 31, neck: 11, head: 7, elbow: 13, wrist: 15 }, right: { hip: 24, knee: 26, ankle: 28, toe: 32, neck: 12, head: 8, elbow: 14, wrist: 16 } };

// What a detector would see if a person did this movement in front of a camera: our poses become landmarks in a 1280x720 picture,
// with a still lead-in and tail, optional mirroring, jitter, and the far side of the body nudged a little.
export function film(m: Movement, o: { realS?: number; mirror?: boolean; side?: "left" | "right"; noise?: number; vis?: number; shoulderGap?: number; ox?: number; lead?: number } = {}): Source {
  const realS = o.realS ?? 1.6, side = o.side ?? "left", noise = rng(11), sig = o.noise ?? 0.8;
  const lead = o.lead ?? LEAD;
  const frames: Source["frames"] = [];
  const total = Math.round((lead + realS + TAIL) * FPS);
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    const k = Math.max(0, Math.min(1, (t - lead) / realS));
    const pose = interpolate(m.keyframes, k);
    const lm: Landmark[] = Array.from({ length: 33 }, () => [0.5, 0.5, 0, o.vis ?? 0.95] as Landmark);
    const put = (n: number, [x, y]: [number, number], dx = 0) => {
      let px = x * PX + (o.ox ?? 100) + dx + noise() * sig;
      const py = y * PX + 60 + noise() * sig;
      if (o.mirror) px = W - px;
      lm[n] = [px / W, py / H, 0, o.vis ?? 0.95];
    };
    for (const j of JOINTS) put(IDX[side][j], pose[j]);
    const far = side === "left" ? "right" : "left";
    put(IDX[far].neck, pose.neck, o.shoulderGap ?? 6); put(IDX[far].hip, pose.hip, 6); put(IDX[far].knee, pose.knee, 6); put(IDX[far].ankle, pose.ankle, 6);
    for (const n of [IDX[far].neck, IDX[far].hip, IDX[far].knee, IDX[far].ankle]) lm[n][3] = (o.vis ?? 0.95) - 0.3; // the far side is less certain, as it is in real footage
    frames.push({ i, t, lm });
  }
  return { fps: FPS, width: W, height: H, frames };
}

