import { expect, test } from "@playwright/test";
import { uniq } from "./helpers";

test("the landing page says it in three beats and takes an email and nothing else", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Players check in." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The agent adjusts." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You approve." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1); // one page heading, for screen readers and search
  await expect(page.getByText("For football performance staff", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "What it never does" })).toBeVisible();

  await page.getByLabel("Work email").fill("not an email");
  await page.getByRole("button", { name: "Request a pilot" }).click();
  await expect(page.getByText("That email does not look right.")).toBeVisible();
  await page.getByLabel("Work email").fill(`pilot-${uniq()}@club.test`);
  await page.getByRole("button", { name: "Request a pilot" }).click();
  await expect(page.getByText("Thanks. We will reply to arrange a call.")).toBeVisible();
});

test("on a phone the landing page fits and the form is reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Request a pilot" })).toBeVisible();
});

test("the morning plays through: the proposal's numbers change, then the approval is sent", async ({ page }) => {
  test.setTimeout(40_000);
  await page.goto("/");
  const opacity = (sel: string) => page.locator(sel).evaluate((e) => getComputedStyle(e).opacity);
  expect(await page.evaluate(() => document.querySelector(".beats")!.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  expect(await opacity(".ap-sent")).toBe("0"); // not yet approved
  await expect.poll(() => opacity(".ap-sent"), { timeout: 20_000 }).toBe("1"); // ...then Sent
  await expect(page.locator(".ap-note-b")).toHaveText("Sent to 3 players. Logged");
});

test("with reduced motion nothing animates and the page shows the finished proposal", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await page.evaluate(() => document.querySelector(".beats")!.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.getByText("3 × 7")).toBeVisible();
  await expect(page.getByText("3 × 4")).toBeVisible();
  expect(await page.locator(".ap-sent").evaluate((e) => getComputedStyle(e).opacity)).toBe("0"); // the story stops before the click
});
