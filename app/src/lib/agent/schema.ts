import { z } from "zod";

export const Exercise = z.object({
  name: z.string(),
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  load: z.string(),
  target_rpe: z.number().nullable().optional(),
});
export type Exercise = z.infer<typeof Exercise>;

export const Edit = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("set_sets"), exercise: z.string(), to: z.number().int().positive() }),
  z.object({ kind: z.literal("set_reps"), exercise: z.string(), to: z.number().int().positive() }),
  z.object({ kind: z.literal("set_load_pct"), exercise: z.string(), to_pct_of_planned: z.number().positive() }),
  z.object({ kind: z.literal("swap"), exercise: z.string(), to_exercise: z.string() }),
]);
export type Edit = z.infer<typeof Edit>;

export const Proposal = z.object({
  decision: z.enum(["none", "reduce", "swap", "increase", "rest", "flag_only"]),
  edits: z.array(Edit),
  reason: z.string().min(1),
  rules_applied: z.array(z.string()),
  flag_to_coach: z.string().nullable().optional(),
});
export type Proposal = z.infer<typeof Proposal>;
