import { matchExercise, norm } from "../library";
import { ALL } from "./data";
import type { Movement } from "./types";

export const MOVEMENTS: Movement[] = ALL;

const byId = new Map(MOVEMENTS.map((m) => [m.id, m]));
const byName = new Map(MOVEMENTS.flatMap((m) => [m.name, ...m.names].map((n) => [norm(n), m] as const)));

// The movement for an exercise as a coach wrote it. An exact library match goes by its library id; otherwise only a name we know
// exactly. A near miss never gets a figure, because a wrong figure is worse than none.
export function movementFor(name: string): Movement | null {
  const m = matchExercise(name);
  if (m.status === "matched") return byId.get(m.exercise.id) ?? byName.get(norm(name)) ?? null;
  return byName.get(norm(name)) ?? null;
}
