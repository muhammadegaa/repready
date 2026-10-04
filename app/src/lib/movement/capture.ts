import { interpolate, retarget } from "./pose";
import { JOINTS, type Joint, type Keyframe, type Movement, type Pose } from "./types";
import { BODY } from "./pose";

// Turns a filmed rep into a Movement. The detector (tools/pose-capture/detect.py) writes 33 body landmarks per frame; this turns the
// ones on the camera side into our eight joints and picks the few frames that describe the movement. A person reviews the result.

export type Landmark = [x: number, y: number, z: number, visibility: number];
export type SourceFrame = { i: number; t: number; lm: Landmark[] | null };
export type Source = { fps: number; width: number; height: number; thumbEvery?: number; frames: SourceFrame[] };

export type CaptureMeta = {
  id: string;
  name: string;
  names: string[];
  cues: string[];
  // Where each phase starts, as a fraction of the movement (0 to 1). The review page shows the key times to choose from.
  phases: { label: string; from: number }[];
  // How the scene is built from the footage: a box the person ends on, a box they start on, a pad under the knees, or just the floor.
  scene: "box-final" | "box-initial" | "pad" | "ground";
  startS?: number; // trim, in seconds of the original video; otherwise the active part is found automatically
  endS?: number;
  side?: "left" | "right" | "auto"; // which side faces the camera
  travel?: "left" | "right" | "auto"; // which way the person moves in the video; the figure always moves right
  durationMs?: number; // how long the figure takes; default is twice the real time, between 2.4 and 6 seconds
  maxKeyframes?: number;
  tolerancePx?: number;
};

export type CaptureReport = {
  side: "left" | "right";
  mirrored: boolean;
  startS: number;
  endS: number;
  realDurationS: number;
  scale: number;
  keyframes: { t: number; sourceTime: number; sourceIndex: number }[];
  maxFitErrorPx: number;
  meanVisibility: number;
  hipHeight: { t: number; y: number }[]; // for the review page
};
export type CaptureResult = { movement: Movement; warnings: string[]; report: CaptureReport };

export { BODY };
const SCENE = { width: 420, height: 340, ground: 300 };
const START_X = { "box-final": 140, "box-initial": 108, pad: 170, ground: 180 } as const;

// BlazePose landmark numbers for the joints we use, by side.
const IDX = {
  left: { hip: 23, knee: 25, ankle: 27, toe: 31, neck: 11, head: 7, elbow: 13, wrist: 15 },
  right: { hip: 24, knee: 26, ankle: 28, toe: 32, neck: 12, head: 8, elbow: 14, wrist: 16 },
} as const;
const NOSE = 0;

type V = [number, number];
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const percentile = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// Gaps where the detector was unsure are filled from the frames either side.
function fill(values: number[], ok: boolean[]): number[] {
  const out = [...values];
  const good = ok.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
  if (!good.length) return out;
  for (let i = 0; i < out.length; i++) {
    if (ok[i]) continue;
    const before = [...good].reverse().find((g) => g < i);
    const after = good.find((g) => g > i);
    if (before === undefined) out[i] = values[after!];
    else if (after === undefined) out[i] = values[before];
    else out[i] = values[before] + ((values[after] - values[before]) * (i - before)) / (after - before);
  }
  return out;
}

// A median of three to drop a single wild frame, then a short moving average.
export function smooth(values: number[], window: number): number[] {
  const m = values.map((v, i) => median([values[Math.max(0, i - 1)], v, values[Math.min(values.length - 1, i + 1)]]));
  const h = Math.max(1, Math.floor(window / 2));
  return m.map((_, i) => mean(m.slice(Math.max(0, i - h), Math.min(m.length, i + h + 1))));
}

type Track = Record<Joint, { x: number[]; y: number[]; vis: number[] }>;

const poseError = (a: Pose, b: Pose) => Math.max(...JOINTS.map((j) => dist(a[j], b[j])));

export function capture(src: Source, meta: CaptureMeta): CaptureResult {
  const warnings: string[] = [];
  const W = src.width, H = src.height;
  const all = src.frames;
  if (all.length < 8) throw new Error("The video has too few frames to read.");
  const detected = all.filter((f) => f.lm).length;
  if (detected < all.length * 0.6) warnings.push(`A person was found in only ${detected} of ${all.length} frames. Film again with the whole body in view.`);
  if (src.fps < 24) warnings.push(`The video is ${src.fps.toFixed(0)} frames a second. 30 or more gives a smoother result.`);

  // --- which side faces the camera
  const vis = (side: "left" | "right") => mean(all.flatMap((f) => (f.lm ? [f.lm[IDX[side].hip][3], f.lm[IDX[side].knee][3], f.lm[IDX[side].ankle][3], f.lm[IDX[side].neck][3]] : [])));
  const side: "left" | "right" = meta.side && meta.side !== "auto" ? meta.side : vis("left") >= vis("right") ? "left" : "right";
  const ix = IDX[side];

  // --- one track per joint: pixels, gaps filled, then smoothed
  const win = Math.max(3, Math.round(src.fps * 0.08) | 1);
  const track = {} as Track;
  for (const j of JOINTS) {
    const xs: number[] = [], ys: number[] = [], vs: number[] = [];
    for (const f of all) {
      let l = f.lm?.[ix[j]];
      if (j === "head" && f.lm && f.lm[ix.head][3] < 0.4) l = f.lm[NOSE]; // ears can hide behind the head; the nose is a fair stand-in
      xs.push(l ? l[0] * W : 0); ys.push(l ? l[1] * H : 0); vs.push(l ? l[3] : 0);
    }
    const ok = vs.map((v) => v >= 0.5);
    track[j] = { x: smooth(fill(xs, ok), win), y: smooth(fill(ys, ok), win), vis: vs };
  }
  const torsoPx = median(all.map((_, i) => Math.hypot(track.neck.x[i] - track.hip.x[i], track.neck.y[i] - track.hip.y[i])));
  if (!(torsoPx > 10)) throw new Error("Could not measure the body in the video.");

  // --- the camera should be side-on: the two shoulders almost on top of each other
  const sep = median(all.flatMap((f) => (f.lm ? [Math.abs(f.lm[11][0] - f.lm[12][0]) * W] : [])));
  if (sep / torsoPx > 0.55) warnings.push("The camera does not look side-on: the shoulders are far apart in the picture. Film from directly to the side.");
  const edge = mean(all.map((f) => (f.lm && f.lm.some((l) => l[3] > 0.5 && (l[0] < 0.01 || l[0] > 0.99 || l[1] < 0.005 || l[1] > 0.995)) ? 1 : 0)));
  if (edge > 0.1) warnings.push("The body touches the edge of the picture in some frames. Step back so the whole body, and the box, stay in view.");

  // --- trim to the active part
  const at = (i: number) => Math.min(all.length - 1, Math.max(0, i));
  const speed = all.map((_, i) => Math.hypot(track.hip.x[at(i + 1)] - track.hip.x[at(i - 1)], track.hip.y[at(i + 1)] - track.hip.y[at(i - 1)]) / torsoPx / Math.max(1e-6, all[at(i + 1)].t - all[at(i - 1)].t));
  const sSmooth = smooth(speed, win);
  const thr = Math.max(0.15 * Math.max(...sSmooth), 0.12);
  const active = sSmooth.map((v, i) => (v > thr ? i : -1)).filter((i) => i >= 0);
  const t0 = all[0].t, tEnd = all[all.length - 1].t;
  const startS = meta.startS ?? Math.max(t0, (active.length ? all[active[0]].t : t0) - 0.3);
  let endS = meta.endS ?? Math.min(tEnd, (active.length ? all[active[active.length - 1]].t : tEnd) + 0.4);
  if (endS - startS < 0.8) { warnings.push("Less than a second of movement was found. If that is wrong, set startS and endS in the meta file."); endS = Math.min(tEnd, startS + 1.5); }
  const idx = all.map((_, i) => i).filter((i) => all[i].t >= startS && all[i].t <= endS);
  if (idx.length < 8) throw new Error("The trimmed clip has too few frames.");
  // more than one repetition in the clip: the hip rises and falls more than once
  const hy = smooth(idx.map((i) => track.hip.y[i]), win * 2 + 1);
  let turns = 0;
  for (let k = 2; k < hy.length - 2; k++) if (hy[k] < hy[k - 1] && hy[k] <= hy[k + 1] && Math.max(...hy) - hy[k] > 0.25 * torsoPx) turns++;
  if (turns > 1 && meta.startS === undefined) warnings.push("The clip seems to hold more than one repetition. Set startS and endS in the meta file to pick one.");

  // --- which way the person travels: the figure always travels to the right
  const x0 = track.hip.x[idx[0]];
  let far = 0;
  for (const i of idx) if (Math.abs(track.neck.x[i] - x0) > Math.abs(far)) far = track.neck.x[i] - x0;
  const mirrored = meta.travel && meta.travel !== "auto" ? meta.travel === "left" : far < 0;
  const mx = (x: number) => (mirrored ? W - x : x);

  // --- into scene units: torso = 62, the floor = 300, the start at a fixed x for the scene
  const s = BODY.torso / torsoPx;
  const floorPx = percentile(idx.map((i) => track.toe.y[i]), 0.95);
  const startHipX = mx(track.hip.x[idx[0]]);
  const place = (x: number, y: number): V => [(mx(x) - startHipX) * s + START_X[meta.scene], (y - floorPx) * s + SCENE.ground];
  const raw = idx.map((i) => Object.fromEntries(JOINTS.map((j) => [j, place(track[j].x[i], track[j].y[i])])) as Record<Joint, V>);

  // --- fit inside the scene if the person travelled further than it is wide
  const xs = raw.flatMap((p) => JOINTS.map((j) => p[j][0]));
  const ys = raw.flatMap((p) => JOINTS.map((j) => p[j][1]));
  const lo = Math.min(...xs), hi = Math.max(...xs);
  if (hi - lo > SCENE.width - 40) warnings.push("The person travels further than the scene is wide, so the figure was scaled down to fit.");
  if (Math.min(...ys) < 10) warnings.push("The person goes above the top of the scene.");
  const k = hi - lo > SCENE.width - 40 ? (SCENE.width - 40) / (hi - lo) : 1;
  let shift = 0;
  if (lo * k < 20) shift = 20 - lo * k;
  if (hi * k + shift > SCENE.width - 20) shift = SCENE.width - 20 - hi * k;
  const fit = (v: V): V => [v[0] * k + shift, SCENE.ground + (v[1] - SCENE.ground) * k];
  const poses = raw.map((p) => Object.fromEntries(JOINTS.map((j) => [j, fit(p[j])])) as Record<Joint, V>);

  // --- scene: a box or pad, from where the feet end up (or start)
  const first = (key: "x" | "y") => median(poses.slice(0, Math.max(3, Math.floor(poses.length * 0.1))).map((p) => p.ankle[key === "x" ? 0 : 1]));
  const last = (key: "x" | "y") => median(poses.slice(-Math.max(3, Math.floor(poses.length * 0.1))).map((p) => p.ankle[key === "x" ? 0 : 1]));
  const scene: Movement["scene"] = { ...SCENE };
  if (meta.scene === "box-final" || meta.scene === "box-initial") {
    const onBox = meta.scene === "box-final" ? { x: last("x"), y: last("y") } : { x: first("x"), y: first("y") };
    const onFloor = meta.scene === "box-final" ? first("y") : last("y");
    const rise = onFloor - onBox.y;
    if (rise < 15) warnings.push("The feet end at the same height as they start, so no box was found. Check scene in the meta file.");
    else scene.box = { x: Math.round(onBox.x - (meta.scene === "box-final" ? 44 : 72)), y: Math.round(SCENE.ground - rise - 3), w: 92 }; // landing: near the middle; starting: near the front edge. The sole sits a few units below the ankle
  } else if (meta.scene === "pad") {
    const kx = median(poses.map((p) => p.knee[0])), ky = median(poses.map((p) => p.knee[1]));
    scene.pad = { x: Math.round(kx - 20), y: Math.round(Math.min(ky - 4, SCENE.ground - 6)), w: 40 };
  }
  const boxTop = scene.box?.y ?? null;
  const boxX = scene.box ? [scene.box.x - 20, scene.box.x + scene.box.w + 20] : null;

  // --- fixed bone lengths; a foot in contact with the floor or box anchors the figure, otherwise the hip does
  const planted = poses.map((p) => {
    const toeY = p.toe[1];
    const onFloor = Math.abs(toeY - SCENE.ground) < 9;
    const onBox = boxTop !== null && boxX !== null && Math.abs(toeY - boxTop) < 9 && p.toe[0] > boxX[0] && p.toe[0] < boxX[1];
    return onFloor || onBox;
  });
  const fixed = poses.map((p, i) => retarget(p, planted[i] ? "ankle" : "hip"));

  // --- keyframes: add the frame that the current set describes worst, until it is close enough or there are enough
  const realT = idx.map((i) => all[i].t);
  const tn = realT.map((t) => (t - realT[0]) / (realT[realT.length - 1] - realT[0]));
  const keys = [0, fixed.length - 1];
  const tol = meta.tolerancePx ?? 7, maxKeys = meta.maxKeyframes ?? 10;
  let fitErr = 0;
  for (;;) {
    const kf: Keyframe[] = keys.map((i) => ({ t: tn[i], pose: fixed[i], contact: planted[i] }));
    const errs = fixed.map((p, i) => poseError(p, interpolate(kf, tn[i])));
    fitErr = Math.max(...errs);
    if (fitErr < tol || keys.length >= maxKeys) break;
    const worst = errs.indexOf(fitErr);
    if (keys.includes(worst)) break;
    keys.push(worst); keys.sort((a, b) => a - b);
  }
  if (fitErr >= tol * 1.6) warnings.push(`The keyframes follow the video to within ${fitErr.toFixed(0)} units at worst. Raise maxKeyframes in the meta file if the review looks off.`);
  const keyframes: Keyframe[] = keys.map((i) => ({ t: Math.round(tn[i] * 1000) / 1000, pose: fixed[i], ...(planted[i] ? { contact: true } : {}) }));
  keyframes[0].t = 0; keyframes[keyframes.length - 1].t = 1;

  const realDur = realT[realT.length - 1] - realT[0];
  const phases = meta.phases.map((p, i) => ({ label: p.label, from: p.from, to: i + 1 < meta.phases.length ? meta.phases[i + 1].from : 1 }));
  if (!phases.length) { phases.push({ label: "Movement", from: 0, to: 1 }); warnings.push("No phases were given, so the whole movement is one phase. Add phases to the meta file."); }
  else if (phases[0].from !== 0) warnings.push("The first phase should start at 0.");
  const movement: Movement = {
    id: meta.id, name: meta.name, names: meta.names, durationMs: meta.durationMs ?? Math.round(Math.min(6000, Math.max(2400, realDur * 2000)) / 100) * 100,
    scene, keyframes, phases, cues: meta.cues, reviewed: false, source: "captured",
  };
  const meanVisibility = mean(idx.flatMap((i) => JOINTS.map((j) => track[j].vis[i])));
  if (meanVisibility < 0.6) warnings.push(`The detector was unsure about the body (average confidence ${meanVisibility.toFixed(2)}). Better light, plainer background and fitted clothing help.`);

  return {
    movement, warnings,
    report: {
      side, mirrored, startS, endS, realDurationS: realDur, scale: s,
      keyframes: keys.map((i) => ({ t: Math.round(tn[i] * 1000) / 1000, sourceTime: realT[i], sourceIndex: all[idx[i]].i })),
      maxFitErrorPx: Math.round(fitErr * 10) / 10, meanVisibility,
      hipHeight: idx.map((i, n) => ({ t: tn[n], y: (floorPx - track.hip.y[i]) * s })),
    },
  };
}
