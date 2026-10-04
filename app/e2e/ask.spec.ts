import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";

// The model is replaced by a fake that "understands" a sentence as the reading written after FAKE_ASK:. That tests everything around
// the model (names hidden from it, previews, checks, saving) but not how well a real model reads a coach. See scripts/eval-ask.mts.
const say = (reading: object) => `FAKE_ASK:${JSON.stringify(reading)}`;
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const inAWeek = () => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

async function ask(page: Page, sentence: string) {
  await page.locator("#ask-q").fill(sentence);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
}

test("a coach asks and tells the agent in words: answers, previews, checks and saves", async ({ page }) => {
  await signUp(page);
  await page.getByRole("button", { name: "Load a sample squad" }).click();
  await expect(page.getByText(/You are looking at a/)).toBeVisible();

  // The buttons answer from stored data without the model.
  await page.getByRole("button", { name: "Who needs me?" }).click();
  await expect(page.getByText(/\d+ waiting for you/)).toBeVisible();
  await expect(page.getByRole("status").getByText(/Mensah/).first()).toBeVisible();
  await page.getByRole("button", { name: "Who hasn't answered?" }).click();
  await expect(page.getByText(/\d+ not checked in/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Copy reminder for/ }).first()).toBeVisible();

  // A sentence about a named player: the name is hidden from the model (the fake fails if it arrives) and restored for the preview.
  await ask(page, `Why was Mensah flagged? ${say({ intent: "why_flagged", player: "Mensah" })}`);
  await expect(page.getByRole("status").getByRole("heading", { name: /Mensah/ })).toBeVisible();
  await expect(page.getByRole("status").getByRole("link", { name: /^Open / })).toBeVisible();

  // Minutes: a preview first, nothing saved until Confirm.
  await ask(page, say({ intent: "log_minutes", date: yesterday(), minutes: [{ player: "Mensah", minutes: 90 }, { player: "Nobody Atall", minutes: 30 }] }));
  await expect(page.getByText(`Save match minutes for ${yesterday()}`)).toBeVisible();
  await expect(page.getByText(/Mensah: 90 min/)).toBeVisible();
  await expect(page.getByText(/Not matched/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Saved minutes for 1 player.")).toBeVisible();

  // A future match day is refused.
  await ask(page, say({ intent: "log_minutes", date: inAWeek(), minutes: [{ player: "Mensah", minutes: 90 }] }));
  await expect(page.getByText("The match day cannot be in the future.")).toBeVisible();

  // A plan change goes through the same limits as the form: a load above the plan is refused, a valid one is previewed and saved.
  await ask(page, say({ intent: "standing_change", player: "Reid", exercise: "Box jump", load_pct: 100 }));
  await expect(page.getByText(/Load must be/)).toBeVisible();
  await ask(page, say({ intent: "standing_change", player: "Reid", exercise: "Hang clean", max_sets: 2 }));
  await expect(page.getByText(/Choose one of the player's exercises/)).toBeVisible();
  await ask(page, say({ intent: "standing_change", player: "Reid", exercise: "Box jump", max_sets: 2, until: inAWeek() }));
  await expect(page.getByRole("status").getByRole("heading", { name: /Change .* plan/ })).toBeVisible();
  await expect(page.getByText(/Box jump: max 2 sets/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(/Saved\. .* has this change/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/set a plan change for .*: Box jump/).first()).toBeVisible();

  // Something the model cannot place changes nothing and says what can be asked.
  await ask(page, say({ intent: "unclear" }));
  await expect(page.getByText(/I can say who needs you/)).toBeVisible();
});

test("the Ask bar fits a phone", async ({ page }) => {
  await signUp(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.locator("#ask-q")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
