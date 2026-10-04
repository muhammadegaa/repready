import free from "./free-exercise-db.json";
import overlay from "./football-overlay.json";

// football-overlay.json is a DRAFT from docs/football-exercise-overlay-DRAFT.csv. Nothing in it is reviewed until `reviewed` is true.
export type LibraryExercise = {
  id: string;
  name: string;
  source: "football" | "free-exercise-db";
  muscles: string[];
  equipment: string | null;
  pattern: string | null;
  image: string | null; // our own path, served by /api/exercise-image
  image_file: string | null; // path inside the free-exercise-db repo, used only by that route
  safe_swaps: string[];
};

// free-exercise-db commit the images are read from. Public domain (LICENSE.md in that repo).
export const IMAGE_SOURCE_SHA = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
export const imageUrlFor = (file: string) => `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${IMAGE_SOURCE_SHA}/exercises/${file}`;

export type Match =
  | { status: "matched"; how: "name" | "alias"; exercise: LibraryExercise }
  | { status: "suggested"; exercise: LibraryExercise }
  | { status: "none" };

export const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => new Set(norm(s).split(" ").filter(Boolean));

const withImage = (id: string, file: string | null) => ({ image: file ? `/api/exercise-image/${encodeURIComponent(id)}` : null, image_file: file });
const general: LibraryExercise[] = free.map((e) => ({
  id: e.id, name: e.name, source: "free-exercise-db", muscles: e.muscles, equipment: e.equipment, pattern: null, ...withImage(e.id, e.image || null), safe_swaps: [],
}));
const generalByName = new Map(general.map((e) => [norm(e.name), e]));
// A football entry shows the picture of a general entry only when that entry's name is exactly one of its own names or aliases. No guessing.
const football: LibraryExercise[] = overlay.map((o) => {
  const twin = [o.name, ...o.aliases].map((n) => generalByName.get(norm(n))).find((g) => g?.image_file);
  return {
    id: o.id, name: o.name, source: "football", muscles: o.muscles, equipment: o.equipment || null, pattern: o.pattern || null,
    image: twin ? `/api/exercise-image/${encodeURIComponent(twin.id)}` : null, image_file: twin?.image_file ?? null, safe_swaps: o.safe_swaps,
  };
});

const byName = new Map<string, LibraryExercise>();
const byAlias = new Map<string, LibraryExercise>();
for (const e of general) byName.set(norm(e.name), e);
for (const e of football) byName.set(norm(e.name), e); // the football entry wins over a general one with the same name
for (const o of overlay) for (const a of o.aliases) byAlias.set(norm(a), football.find((f) => f.id === o.id)!);

export const exerciseById = (id: string) => [...football, ...general].find((e) => e.id === id) ?? null;

// The picture for an exercise name as written in a program. Only an exact library match gets one.
export function imageForName(name: string): string | null {
  const m = matchExercise(name);
  return m.status === "matched" ? m.exercise.image : null;
}

// Exact name or alias is a match. A near miss is only a suggestion: staff confirm it, we never rewrite their program silently.
export function matchExercise(raw: string): Match {
  const q = norm(raw);
  if (!q) return { status: "none" };
  // An overlay alias beats a general-library name: "barbell full squat" is our back squat.
  const alias = byAlias.get(q);
  if (alias) return { status: "matched", how: "alias", exercise: alias };
  const exact = byName.get(q);
  if (exact) return { status: "matched", how: "name", exercise: exact };

  const qt = tokens(raw);
  let best: { e: LibraryExercise; score: number } | null = null;
  for (const e of [...football, ...general]) {
    const et = tokens(e.name);
    const shared = [...qt].filter((t) => et.has(t)).length;
    if (!shared) continue;
    const score = shared / Math.max(qt.size, et.size);
    if (!best || score > best.score) best = { e, score };
  }
  return best && best.score >= 0.6 ? { status: "suggested", exercise: best.e } : { status: "none" };
}
