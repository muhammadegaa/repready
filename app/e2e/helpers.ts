import { expect, type Browser, type Page } from "@playwright/test";

export const PASSWORD = "e2e-password-123";
export const today = () => new Date().toISOString().slice(0, 10);
export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function signUp(page: Page, club = `E2E FC ${uniq()}`, emailOverride?: string) {
  const email = emailOverride ?? `coach-${uniq()}@e2e.test`;
  await page.goto("/signup");
  await page.locator("#club").fill(club);
  await page.locator("#name").fill("Alex Coach");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("form button").click();
  await page.waitForURL(/\/coach$/);
  return { email, club };
}

// Gives the coach's program the way a coach does: pasted into Program, read, checked, then used. Rows are
// "date,label,week_type,exercise,sets,reps,load,target_rpe[,group]"; the fake model server reads them back exactly.
export async function importProgram(page: Page, rows: string[]) {
  const sessions = new Map<string, { day: null; date: string; label: string; week_type: string; group: string | null; exercises: object[] }>();
  for (const row of rows.filter((r) => !r.startsWith("date,"))) {
    const [date, label, week_type, name, sets, reps, load, rpe, group] = row.split(",");
    const key = `${date}|${label}|${group ?? ""}`;
    const s = sessions.get(key) ?? { day: null, date, label, week_type, group: group || null, exercises: [] };
    s.exercises.push({ name, sets: Number(sets), reps: Number(reps), load, target_rpe: rpe ? Number(rpe) : null });
    sessions.set(key, s);
  }
  await page.goto("/coach/program");
  await page.locator("#program_text").fill(`FAKE_PROGRAM:${JSON.stringify([...sessions.values()])}`);
  await page.getByRole("button", { name: "Read my program" }).click();
  await page.getByRole("button", { name: "Use this program" }).click();
  await expect(page.getByText(/^Saved \d+ sessions?/)).toBeVisible();
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

// Taps a visible pill like a player does and confirms it stuck. Retried, because a page that is still hydrating can drop an early tap.
export async function pick(page: Page, name: string, value: number) {
  const pill = page.locator(`label:has(input[name="${name}"][value="${value}"])`);
  await expect(async () => {
    await pill.click();
    await expect(page.locator(`input[name="${name}"][value="${value}"]`)).toBeChecked({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}
