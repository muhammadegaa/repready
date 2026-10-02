import { expect, test } from "@playwright/test";
import { addPlayer, agreeAndClaim, importProgram, newPhone, PASSWORD, pick, playerLink, signUp, squadLink, today, uniq } from "./helpers";

test("a new coach lands on a checklist that updates as they set up", async ({ page }) => {
  await signUp(page);
  await expect(page.getByText("Getting started")).toBeVisible();
  await expect(page.getByText("0/4")).toBeVisible();
  await addPlayer(page, "Sam Okoro");
  await page.goto("/coach");
  await expect(page.getByText("1 of 4 done")).toBeVisible();
  await importProgram(page, [`${today()},Lower,normal,Back squat,4,5,85%,8`]);
  await page.goto("/coach");
  await expect(page.getByText("2 of 4 done")).toBeVisible();
});

test("adding players confirms, and one bad line keeps the pasted list", async ({ page }) => {
  await signUp(page);
  await page.goto("/coach/squad");
  const bad = "J. Mensah, 5, Centre-back\nBad Row, abc, Wizard";
  await page.locator("#list").fill(bad);
  await page.getByRole("button", { name: "Add players", exact: true }).click();
  await expect(page.getByText("Line 2: shirt number must be 1 to 99 or empty.")).toBeVisible();
  await expect(page.locator("#list")).toHaveValue(bad);
  await page.locator("#list").fill("J. Mensah, 5, Centre-back\nL. Ortiz, 9, Forward, U21");
  await page.getByRole("button", { name: "Add players", exact: true }).click();
  await expect(page.getByText("Added 2 players.")).toBeVisible();
  await expect(page.locator("#list")).toHaveValue("");
});

test("a player joins by the squad link and the coach confirms them", async ({ page, browser }) => {
  await signUp(page);
  const join = await squadLink(page);
  const phone = await newPhone(browser);
  await phone.page.goto(join);
  await phone.page.locator("#name").fill("Dee Joiner");
  await phone.page.locator("#shirt").fill("11");
  await phone.page.locator('input[name="adult"]').check();
  await phone.page.getByRole("button", { name: "Join the squad" }).click();
  await phone.page.waitForURL(/\/a\//);
  await page.goto("/coach/squad");
  await expect(page.getByText("Waiting for you")).toBeVisible();
  await page.getByRole("button", { name: "Confirm player" }).click();
  await expect(page.getByText("Waiting for you")).toHaveCount(0);
  await expect(page.locator("section#players").getByText("Dee Joiner").first()).toBeVisible();
  await phone.ctx.close();
});

test("a pain note reaches the coach as a flag with no automatic edit", async ({ page, browser }) => {
  await signUp(page);
  await importProgram(page, [`${today()},Lower,normal,Back squat,4,5,85%,8`, `${today()},Lower,normal,Nordics,3,5,BW,8`]);
  await expect(page.getByText("Nordic hamstring curl").first()).toBeVisible(); // alias matched to the library name
  await addPlayer(page, "Pat Player");
  const link = await playerLink(page);
  const phone = await newPhone(browser);
  await phone.page.goto(link);
  await agreeAndClaim(phone.page);
  await phone.page.locator('input[name="sleep_h"]').fill("7");
  await pick(phone.page, "soreness", 2);
  await pick(phone.page, "stress", 2);
  await phone.page.locator('textarea[name="note"]').fill("sharp pain in left knee after the match");
  await phone.page.getByRole("button", { name: "Send check-in" }).click();
  await expect(phone.page.getByText("Your coach is reviewing")).toBeVisible({ timeout: 20_000 });
  await page.goto("/coach");
  await expect(page.getByRole("heading", { name: "Check before training" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("No edit to the session is proposed.")).toBeVisible();
  // The player still sees the plan as written until the coach decides.
  await expect(phone.page.getByText("Shown as planned")).toBeVisible();
  await phone.ctx.close();
});

test("one club cannot open another club's player", async ({ browser }) => {
  const a = await browser.newContext(); const pa = await a.newPage();
  await signUp(pa, `Club A ${uniq()}`);
  await addPlayer(pa, "Secret Player");
  const link = await playerLink(pa);
  const code = link.split("/").pop()!;
  const b = await browser.newContext(); const pb = await b.newPage();
  await signUp(pb, `Club B ${uniq()}`);
  const res = await pb.goto(`/coach/athletes/${code}`);
  expect(res?.status()).toBe(404);
  await expect(pb.getByText("Secret Player")).toHaveCount(0);
  await a.close(); await b.close();
});

test("staff pages need a sign-in, and a wrong password is refused", async ({ page }) => {
  await page.goto("/coach");
  await expect(page).toHaveURL(/signin/);
  await page.locator("#email").fill("nobody@e2e.test");
  await page.locator("#password").fill(PASSWORD);
  await page.locator("form button").click();
  await expect(page.getByText("That email and password did not match.")).toBeVisible();
});
