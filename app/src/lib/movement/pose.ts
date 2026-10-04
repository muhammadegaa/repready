import { JOINTS, type Joint, type Keyframe, type Movement, type Pose } from "./types";

// Our canonical body: every figure, hand-placed or captured, is drawn with these bone lengths.
export const BODY = { torso: 62, thigh: 46, shin: 48, foot: 17, upper: 32, fore: 33, head: 22 } as const;

type V = [number, number];
const r1 = (v: V): [number, number] => [Math.round(v[0] * 10) / 10, Math.round(v[1] * 10) / 10];

// Rebuilds a pose with the canonical bone lengths, keeping each bone's direction. The hip anchors the figure in the air; a planted
// foot anchors it instead, so a figure standing on the floor does not slide.
export function retarget(p: Record<Joint, V>, anchor: "hip" | "ankle"): Pose {
  const ang = (a: V, b: V) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const step = (from: V, a: number, l: number): V => [from[0] + l * Math.cos(a), from[1] + l * Math.sin(a)];
  const A = {
    torso: ang(p.hip, p.neck), thigh: ang(p.hip, p.knee), shin: ang(p.knee, p.ankle), foot: ang(p.ankle, p.toe),
    upper: ang(p.neck, p.elbow), fore: ang(p.elbow, p.wrist), head: ang(p.neck, p.head),
  };
  const o = {} as Record<Joint, V>;
  if (anchor === "hip") {
    o.hip = [p.hip[0], p.hip[1]]; o.knee = step(o.hip, A.thigh, BODY.thigh); o.ankle = step(o.knee, A.shin, BODY.shin);
  } else {
    o.ankle = [p.ankle[0], p.ankle[1]]; o.knee = step(o.ankle, A.shin + Math.PI, BODY.shin); o.hip = step(o.knee, A.thigh + Math.PI, BODY.thigh);
  }
  o.toe = step(o.ankle, A.foot, BODY.foot);
  o.neck = step(o.hip, A.torso, BODY.torso); o.head = step(o.neck, A.head, BODY.head);
  o.elbow = step(o.neck, A.upper, BODY.upper); o.wrist = step(o.elbow, A.fore, BODY.fore);
  return Object.fromEntries(JOINTS.map((j) => [j, r1(o[j])])) as Pose;
}

// A smooth curve through the keyframe values that never overshoots them (monotone cubic, Fritsch and Butland), at rest at both ends.
function curve(ts: number[], ys: number[], x: number): number {
  const n = ts.length;
  let k = 0;
  while (k < n - 2 && x >= ts[k + 1]) k++;
  const h = ts.map((t, i) => (i < n - 1 ? ts[i + 1] - t : 0));
  const d = ys.map((y, i) => (i < n - 1 ? (ys[i + 1] - y) / (h[i] || 1) : 0));
  const m = ys.map((_, i) => {
    if (i === 0 || i === n - 1) return 0;
    if (d[i - 1] * d[i] <= 0) return 0;
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  });
  const s = h[k] > 0 ? (x - ts[k]) / h[k] : 1;
  return (2 * s ** 3 - 3 * s ** 2 + 1) * ys[k] + (s ** 3 - 2 * s ** 2 + s) * h[k] * m[k] + (-2 * s ** 3 + 3 * s ** 2) * ys[k + 1] + (s ** 3 - s ** 2) * h[k] * m[k + 1];
}

const SEGMENTS = [["torso", "hip", "neck"], ["thigh", "hip", "knee"], ["shin", "knee", "ankle"], ["foot", "ankle", "toe"], ["upper", "neck", "elbow"], ["fore", "elbow", "wrist"], ["head", "neck", "head"]] as const;
type Seg = (typeof SEGMENTS)[number][0];

// A bone's direction in each keyframe, with whole turns added so that neighbouring keyframes are never more than half a turn apart.
function unwrapped(values: number[]): number[] {
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) {
    let v = values[i];
    while (v - out[i - 1] > Math.PI) v -= 2 * Math.PI;
    while (v - out[i - 1] < -Math.PI) v += 2 * Math.PI;
    out.push(v);
  }
  return out;
}

// The pose at time t (0 to 1), the way a skeleton is animated: each bone's direction and the hip's position follow a smooth curve through
// the keyframes, and the body is rebuilt from them, so the bones always keep their length and a swinging arm turns instead of snapping.
// Between two keyframes with a planted foot the ankle is the anchor, so the foot stays put. Outside the range it holds the end pose.
export function interpolate(keyframes: Keyframe[], t: number): Pose {
  const x = Math.max(0, Math.min(1, t));
  const last = keyframes[keyframes.length - 1];
  if (x >= last.t) return last.pose;
  const ts = keyframes.map((k) => k.t);
  const dir = {} as Record<Seg, number>;
  for (const [name, a, b] of SEGMENTS) {
    dir[name] = curve(ts, unwrapped(keyframes.map((k) => Math.atan2(k.pose[b][1] - k.pose[a][1], k.pose[b][0] - k.pose[a][0]))), x);
  }
  let i = 0;
  while (i < keyframes.length - 2 && x >= keyframes[i + 1].t) i++;
  const planted = Boolean(keyframes[i].contact && keyframes[i + 1].contact);
  const at = (j: Joint): V => [curve(ts, keyframes.map((k) => k.pose[j][0]), x), curve(ts, keyframes.map((k) => k.pose[j][1]), x)];
  const go = (from: V, a: number, l: number): V => [from[0] + l * Math.cos(a), from[1] + l * Math.sin(a)];
  const o = {} as Record<Joint, V>;
  if (planted) {
    o.ankle = at("ankle"); o.knee = go(o.ankle, dir.shin + Math.PI, BODY.shin); o.hip = go(o.knee, dir.thigh + Math.PI, BODY.thigh);
  } else {
    o.hip = at("hip"); o.knee = go(o.hip, dir.thigh, BODY.thigh); o.ankle = go(o.knee, dir.shin, BODY.shin);
  }
  o.toe = go(o.ankle, dir.foot, BODY.foot);
  o.neck = go(o.hip, dir.torso, BODY.torso); o.head = go(o.neck, dir.head, BODY.head);
  o.elbow = go(o.neck, dir.upper, BODY.upper); o.wrist = go(o.elbow, dir.fore, BODY.fore);
  return Object.fromEntries(JOINTS.map((j) => [j, r1(o[j])])) as Pose;
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
