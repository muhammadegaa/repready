import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

async function withSample(page: import("@playwright/test").Page) {
  await signUp(page);
  await page.goto("/coach/squad?view=people");
  await page.getByRole("button", { name: "Load a sample squad" }).click();
  await expect(page.getByText(/Sample squad loaded/).first()).toBeVisible();
}

test("Today shows check-ins as a ring and the pictures carry a text alternative", async ({ page }) => {
  await withSample(page);
  await page.goto("/coach");
  await expect(page.getByRole("img", { name: /Checked in: 4 of 6/ })).toBeVisible();
  await expect(page.getByLabel("Summary")).toContainText(/Checked in\s*4\/6/);
});

test("a player's page draws each measure against their own usual range", async ({ page }) => {
  await withSample(page);
  await page.goto("/coach");
  await page.locator('a[href^="/coach/athletes/"]').first().click();
  await expect(page.getByRole("img", { name: /^Sleep, last 14 days\./ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Soreness, last 14 days\./ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Stress, last 14 days\./ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Effort against the plan, last 14 days\./ })).toBeVisible();
  await expect(page.getByText(/own usual range from the days before today/)).toBeVisible();
});

test("Program shows the week around the match", async ({ page }) => {
  await withSample(page);
  const d = new Date();
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  const saturday = new Date(monday.getTime() + 5 * 86_400_000).toISOString().slice(0, 10);
  await page.goto("/coach/program");
  await page.locator("#fixtures").fill(saturday);
  await page.getByRole("button", { name: "Save fixtures" }).click();
  await page.goto("/coach/program");
  const week = page.getByRole("img", { name: /^This week: / });
  await expect(week).toBeVisible();
  await expect(week).toHaveAttribute("aria-label", /Sat match/);
  await expect(page.getByText("MD-1", { exact: true })).toBeVisible();
});

test("the Agent page shows the three steps with what is never automatic", async ({ page }) => {
  await signUp(page);
  await page.goto("/coach/agent");
  await expect(page.getByText("Approve together", { exact: true })).toBeVisible();
  await expect(page.getByText("Handle it", { exact: true })).toBeVisible();
  await expect(page.getByText(/Never automatic:/)).toBeVisible();
});
