export const JOINTS = ["hip", "knee", "ankle", "toe", "neck", "head", "elbow", "wrist"] as const;
export type Joint = (typeof JOINTS)[number];
export type Pose = Record<Joint, [number, number]>;
// `contact` marks a keyframe where the foot is planted on the floor or box, so the feet stay put between two such keyframes.
export type Keyframe = { t: number; pose: Pose; contact?: boolean };

// One exercise as a short run of poses seen from the side. Drawn by components/movement/MovementFigure.
export type Movement = {
  id: string; // the library id it belongs to, or the id it would have
  name: string;
  names: string[]; // other ways a coach writes it, lower case
  durationMs: number;
  scene: { width: number; height: number; ground: number; box?: { x: number; y: number; w: number }; pad?: { x: number; y: number; w: number } };
  keyframes: Keyframe[];
  phases: { label: string; from: number; to: number }[];
  cues: string[];
  reviewed: boolean; // false until a sports scientist has checked the technique and the cues
  source?: "hand-placed" | "captured"; // hand-placed poses are a sketch; captured ones come from a filmed rep and still need that review
};
