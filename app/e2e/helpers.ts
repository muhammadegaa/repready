import { expect, type Browser, type Page } from "@playwright/test";

export const PASSWORD = "e2e-password-123";
export const today = () => new Date().toISOString().slice(0, 10);
export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function signUp(page: Page, club = `E2E FC ${uniq()}`) {
  const email = `coach-${uniq()}@e2e.test`;
  await page.goto("/signup");
  await page.locator("#club").fill(club);
  await page.locator("#name").fill("Alex Coach");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("form button").click();
  await page.waitForURL(/\/coach$/);
  return { email, club };
}

export async function importProgram(page: Page, rows: string[]) {
  await page.goto("/coach/program");
  await page.locator("#csv").fill(["date,label,week_type,exercise,sets,reps,load,target_rpe", ...rows].join("\n"));
  await page.getByRole("button", { name: /import program|replace program/i }).click();
  await expect(page.getByText("Upcoming sessions")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

export async function addPlayer(page: Page, name: string) {
  await page.goto("/coach/squad");
  await page.locator("#p-name").fill(name);
  await page.getByRole("button", { name: "Add player", exact: true }).click();
  await expect(page.getByText(`Added ${name}.`)).toBeVisible();
}

// The personal link of the nth player listed on the Squad page, read from its WhatsApp share link.
export async function playerLink(page: Page, index = 0): Promise<string> {
  await page.goto("/coach/squad");
  const hrefs = await page.locator('section#players a:has-text("Send on WhatsApp")').evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
  const m = decodeURIComponent(hrefs[index]).match(/https?:\/\/[^\s]+\/a\/[0-9a-f]+/);
  if (!m) throw new Error("no player link found");
  return new URL(m[0]).pathname;
}

export async function squadLink(page: Page): Promise<string> {
  await page.goto("/coach/squad");
  const href = await page.locator('a:has-text("Send on WhatsApp")').first().evaluate((e) => (e as HTMLAnchorElement).href);
  const m = decodeURIComponent(href).match(/https?:\/\/[^\s]+\/join\/[0-9a-f]+/);
  if (!m) throw new Error("no squad link found");
  return new URL(m[0]).pathname;
}

// A fresh browser context stands in for one player's phone.
export async function newPhone(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 900 } });
  return { ctx, page: await ctx.newPage() };
}

export async function agreeAndClaim(page: Page) {
  const agree = page.locator('input[name="agree"]');
  if (await agree.count()) {
    await agree.check();
    await page.getByRole("button", { name: "Continue" }).click();
  }
  const claim = page.getByText("Use this phone for RepReady?");
  if (await claim.isVisible().catch(() => false)) await page.getByRole("button", { name: "Continue" }).click();
}
