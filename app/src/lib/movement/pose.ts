import { JOINTS, type Joint, type Keyframe, type Movement, type Pose } from "./types";

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// The pose at time t (0 to 1): each joint eases between the two keyframes either side of t. Outside the range it holds the end pose.
export function interpolate(keyframes: Keyframe[], t: number): Pose {
  const x = Math.max(0, Math.min(1, t));
  const last = keyframes[keyframes.length - 1];
  if (x >= last.t) return last.pose;
  let i = 0;
  while (i < keyframes.length - 2 && x >= keyframes[i + 1].t) i++;
  const a = keyframes[i], b = keyframes[i + 1];
  const span = b.t - a.t;
  const k = span <= 0 ? 1 : easeInOut((x - a.t) / span);
  const out = {} as Pose;
  for (const j of JOINTS) out[j as Joint] = [a.pose[j][0] + (b.pose[j][0] - a.pose[j][0]) * k, a.pose[j][1] + (b.pose[j][1] - a.pose[j][1]) * k];
  return out;
}

export function phaseAt(phases: Movement["phases"], t: number): string {
  const p = phases.find((ph) => t >= ph.from && t < ph.to) ?? phases[phases.length - 1];
  return p.label;
}

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// The lengths of the bones in a pose, so a pose that stretches or squashes the figure can be caught.
export function bones(p: Pose) {
  return { torso: dist(p.neck, p.hip), thigh: dist(p.hip, p.knee), shin: dist(p.knee, p.ankle), upperArm: dist(p.neck, p.elbow), forearm: dist(p.elbow, p.wrist) };
}
