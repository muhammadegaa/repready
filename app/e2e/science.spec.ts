import { expect, test, type Page } from "@playwright/test";
import rulesFile from "../src/lib/agent/rules.json";
import { decide } from "../src/lib/agent/engine";
import { agrees, PASS_DO_NOTHING, PASS_OVERALL, summarize } from "../src/lib/agent/score";
import { SCENARIOS } from "../src/lib/scenarios";
import { signUp } from "./helpers";

const ALL_RULES = rulesFile.rules.map((r) => r.id);

// The score the page should show: the engine run directly on the scenarios the scientist labelled.
function expectedScore(labels: Record<string, { decision: string; edits: Parameters<typeof agrees>[0]["edits"] }>, active: string[]) {
  const rows = SCENARIOS.filter((s) => labels[s.id]).map((s) => {
    const { proposal, verdict } = decide({ athlete: s.athlete, planned_session: s.planned_session, last_14_days: s.last_14_days }, new Set(active));
    const mine = labels[s.id];
    return { expected: mine.decision, agree: agrees(mine, { decision: proposal.decision, edits: verdict.accepted }, s.planned_session.exercises), holdout: s.holdout, engine: proposal.decision };
  });
  return { ...summarize(rows), rows };
}

const pct = (v: number | null) => (v === null ? "–" : `${v}%`);

async function stat(page: Page, label: string) {
  const card = page.locator("section.grid > *").filter({ hasText: label }).first();
  return (await card.innerText()).replace(new RegExp(label, "i"), "").split("\n").map((t) => t.trim()).filter(Boolean)[0];
}

async function decideScenario(page: Page, decision: string, reason: string) {
  await page.locator("#decision").selectOption(decision);
  if (reason) await page.locator("#reason").fill(reason);
  await page.getByRole("button", { name: /Save decision|Update label/ }).click();
}

test("a scientist labels scenarios, runs the evaluation, and the page shows the same score as the engine", async ({ page }) => {
  await signUp(page);

  // Reach Evaluation the way a person does: More, then Science.
  await page.getByRole("button", { name: /More/ }).click();
  await page.getByRole("menuitem", { name: "Evaluation" }).click();
  await expect(page.getByRole("heading", { name: "Evaluation" })).toBeVisible();
  await expect(page.getByText(/0 of 30 done/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Run on 0 decided/ })).toBeDisabled();
  await expect(page.getByText("Decide at least one scenario first.")).toBeVisible();

  // The start button leads to the first scenario.
  await page.getByRole("link", { name: "Start with the first scenario" }).click();
  await expect(page).toHaveURL(/\/science\/label\/S01$/);

  // Saving without a reason is refused and nothing is stored.
  await page.locator("#decision").selectOption("none");
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByText("Write a one-sentence reason.")).toBeVisible();
  await expect(page.getByText("Rule tags unlock after you save a decision")).toBeVisible();

  const labels: Record<string, { decision: string; edits: Parameters<typeof agrees>[0]["edits"] }> = {};

  // Label the twenty regular scenarios "no change", moving through them from the Evaluation page's next button.
  for (let n = 1; n <= 20; n++) {
    const id = `S${String(n).padStart(2, "0")}`;
    if (n > 1) {
      await page.goto("/science/evaluation");
      await page.getByRole("link", { name: "Next undecided scenario" }).click();
    }
    await expect(page).toHaveURL(new RegExp(`/science/label/${id}$`));
    await decideScenario(page, "none", `No input is outside the usual range for ${id}.`);
    await expect(page.getByText("Saved.")).toBeVisible();
    labels[id] = { decision: "none", edits: [] };
  }
  // The rule tags appear once a decision is saved.
  await expect(page.getByText("Which rules explain it?")).toBeVisible();

  // One held-out scenario labelled with an edit: one set fewer on the first exercise.
  await page.goto("/science/label/S21");
  await expect(page.getByText("Held out").first()).toBeVisible();
  const first = SCENARIOS.find((s) => s.id === "S21")!.planned_session.exercises[0];
  await page.locator("#decision").selectOption("reduce");
  await page.getByLabel(`Sets for ${first.name}`).fill(String(first.sets - 1));
  await page.locator("#reason").fill("One set fewer on the main lift keeps the pattern and trims volume.");
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  labels.S21 = { decision: "reduce", edits: [{ exercise: first.name, kind: "set_sets", to: first.sets - 1 }] };

  // Run it.
  await page.goto("/science/evaluation");
  await expect(page.getByText(/21 of 30 done/)).toBeVisible();
  await page.getByRole("button", { name: "Run on 21 decided scenarios" }).click();
  await expect(page.getByText(/Last run/)).toBeVisible();

  const want = expectedScore(labels, ALL_RULES);
  expect(want.labeled).toBe(21);
  expect(await stat(page, "Agreement")).toBe(pct(want.agreement));
  expect(await stat(page, "No-change cases")).toBe(pct(want.do_nothing_agreement));
  expect(await stat(page, "Held out")).toBe(pct(want.holdout_agreement));
  const passes = (want.agreement ?? 0) >= PASS_OVERALL && (want.do_nothing_agreement ?? 100) >= PASS_DO_NOTHING;
  await expect(page.getByText(passes ? "Meets the bar" : "Below the bar")).toBeVisible();
  await expect(page.getByText("Decide 20 scenarios for a verdict")).toHaveCount(0);

  // Every row shows the rules' decision, with a tick or cross matching the engine.
  const rowFor = (id: string) => page.locator(`a[href="/science/label/${id}"]`);
  for (const [i, r] of want.rows.entries()) {
    const id = SCENARIOS.filter((s) => labels[s.id])[i].id;
    const row = rowFor(id);
    await expect(row).toContainText(`Rules: ${r.engine.replace("_", " ")}`);
    await expect(row).toContainText(r.agree ? "✓" : "✗");
  }

  // Deleting a rule on the Rules page makes the last run out of date, and a new run reflects the change.
  const fired = new Set(SCENARIOS.flatMap((s) => decide({ athlete: s.athlete, planned_session: s.planned_session, last_14_days: s.last_14_days }, new Set(ALL_RULES)).proposal.rules_applied));
  const target = ["R1", "R2", "R3", "R4", "R5", "R9"].find((r) => fired.has(r));
  test.skip(!target, "no deletable rule fires on any scenario");
  await page.goto("/science");
  await page.locator(`#keep-${target}`).selectOption("delete");
  await page.getByRole("button", { name: `Save ${target}`, exact: true }).click();
  await expect(page.getByText("Deleted").first()).toBeVisible();
  await page.goto("/science/evaluation");
  await expect(page.getByText(/You changed the rules since that run/)).toBeVisible();
  await page.getByRole("button", { name: "Run on 21 decided scenarios" }).click();
  await expect(page.getByText(/You changed the rules since that run/)).toHaveCount(0);
  const after = expectedScore(labels, ALL_RULES.filter((r) => r !== target));
  expect(await stat(page, "Agreement")).toBe(pct(after.agreement));
  await expect(page.getByText("Earlier runs")).toBeVisible();
});

test("signed-out visitors cannot open the science pages", async ({ page }) => {
  await page.goto("/science/evaluation");
  await expect(page).toHaveURL(/signin/);
  await page.goto("/science/label/S01");
  await expect(page).toHaveURL(/signin/);
});
