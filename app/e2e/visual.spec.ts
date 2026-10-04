import { expect, test } from "@playwright/test";
import { agreeAndClaim, newPhone, signUp } from "./helpers";

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

async function onPlayersPhone(page: import("@playwright/test").Page, browser: import("@playwright/test").Browser, reduced = false) {
  await withSample(page);
  await page.goto("/coach/squad?view=people");
  const href = await page.getByRole("link", { name: "Try as this player" }).first().getAttribute("href");
  const phone = await newPhone(browser);
  if (reduced) await phone.page.emulateMedia({ reducedMotion: "reduce" });
  await phone.page.goto(href!);
  await agreeAndClaim(phone.page);
  await expect(phone.page.getByRole("button", { name: "Send check-in" })).toBeVisible();
  return phone;
}

test("a player can open a figure for an exercise, slow it, scrub to a phase and close it", async ({ page, browser }) => {
  const phone = await onPlayersPhone(page, browser);
  const p = phone.page;
  await p.locator("tr", { hasText: "Box jump" }).getByRole("button", { name: "Show me" }).click();
  const sheet = p.getByRole("dialog", { name: "How to do Box jump" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("img", { name: /Box jump, side view/ })).toBeVisible();
  await expect(sheet.getByText("Load: hips back, arms behind")).toBeVisible();
  await expect(sheet.getByText(/waiting for a sports scientist to check it/)).toBeVisible();

  // It plays by itself; pause it, then scrub into the jump.
  await expect(sheet.getByRole("button", { name: "Pause" })).toBeVisible();
  await sheet.getByRole("button", { name: "Pause" }).click();
  await expect(sheet.getByRole("button", { name: "Play" })).toBeVisible();
  await sheet.getByRole("slider", { name: "Position in the movement" }).fill("0.3");
  await expect(sheet.getByRole("slider", { name: "Position in the movement" })).toHaveAttribute("aria-valuetext", "Jump");
  await sheet.getByRole("button", { name: "¼×" }).click();
  await expect(sheet.getByRole("button", { name: "¼×" })).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", { name: /^Go to Stand tall/ }).click();
  await expect(sheet.getByRole("slider", { name: "Position in the movement" })).toHaveAttribute("aria-valuetext", "Stand tall");

  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await phone.ctx.close();
});

test("an exercise without a figure but with library pictures shows the pair, and one with neither shows nothing", async ({ page, browser }) => {
  const phone = await onPlayersPhone(page, browser);
  const p = phone.page;
  await p.locator("tr", { hasText: "Romanian deadlift" }).getByRole("button", { name: "Show me" }).click();
  const sheet = p.getByRole("dialog", { name: "How to do Romanian deadlift" });
  await expect(sheet.getByRole("img", { name: /start position/ })).toBeAttached();
  await expect(sheet.getByRole("img", { name: /end position/ })).toBeAttached();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(p.locator("tr", { hasText: "Hamstring slider curl" }).getByRole("button", { name: "Show me" })).toHaveCount(0); // no exact picture, no figure
  await phone.ctx.close();
});

test("with reduced motion the figure starts paused, on its first position", async ({ page, browser }) => {
  const phone = await onPlayersPhone(page, browser, true);
  const p = phone.page;
  await p.locator("tr", { hasText: "Box jump" }).getByRole("button", { name: "Show me" }).click();
  const sheet = p.getByRole("dialog", { name: "How to do Box jump" });
  await expect(sheet.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(sheet.getByRole("slider", { name: "Position in the movement" })).toHaveValue("0");
  await sheet.getByRole("button", { name: "Play" }).click(); // they can still choose to play it
  await expect(sheet.getByRole("button", { name: "Pause" })).toBeVisible();
  await phone.ctx.close();
});
