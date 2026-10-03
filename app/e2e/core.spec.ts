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

test("a coach pastes a squad, checks what was read, and then adds it; unreadable lines are listed, not fatal", async ({ page }) => {
  await signUp(page);
  await page.goto("/coach/squad");
  await page.locator("#list").fill("Player\tPos\tNo\tGroup\nJ. Mensah\tCB\t5\tStarters\nL. Ortiz\tST\t9\tReserves\nBad Row\tGK\tabc");
  await page.getByRole("button", { name: "Read my squad" }).click();
  await expect(page.getByText("I found 2 players")).toBeVisible();
  await expect(page.getByText(/Left out/)).toBeVisible();
  await expect(page.getByText("#5 · Centre-back · First team · Group: Starters")).toBeVisible();
  await page.getByRole("button", { name: "Add 2 players" }).click();
  await expect(page.getByText("Added 2 players.")).toBeVisible();
  await expect(page.getByText("J. Mensah").first()).toBeVisible();
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

test("the player's session shows a picture only where the library has the exact exercise", async ({ page, browser }) => {
  await signUp(page);
  await importProgram(page, [`${today()},Lower,normal,Back squat,4,5,85%,8`, `${today()},Lower,normal,Nordics,3,5,BW,8`]);
  await addPlayer(page, "Pic Player");
  const phone = await newPhone(browser);
  await phone.page.goto(await playerLink(page));
  await agreeAndClaim(phone.page);
  const squat = phone.page.locator("tr", { hasText: "Back squat" });
  const nordic = phone.page.locator("tr", { hasText: "Nordic hamstring curl" });
  await expect(squat.locator("img")).toHaveAttribute("src", /\/api\/exercise-image\/Barbell_Full_Squat/);
  await expect(nordic).toBeVisible();
  await expect(nordic.locator("img")).toHaveCount(0);
  // The route answers from our own address (the pinned upstream is only reached when the network allows it).
  const res = await phone.page.request.get("/api/exercise-image/Barbell_Full_Squat");
  expect([200, 502]).toContain(res.status());
  if (res.status() === 200) expect(res.headers()["content-type"]).toMatch(/^image\//);
  expect((await phone.page.request.get("/api/exercise-image/not-in-library")).status()).toBe(404);
  await phone.ctx.close();
});

test("a coach splits the squad: the group gets its own version of the session and everyone else keeps the base", async ({ page, browser }) => {
  await signUp(page);
  await importProgram(page, [
    `${today()},Lower,normal,Back squat,4,5,85%,8`,
    `${today()},Lower,normal,Romanian deadlift,3,8,70%,7`,
  ]);
  // The group column is a ninth, optional column: import again with a Reserves version alongside the base.
  await page.goto("/coach/program");
  await page.locator("#advanced summary").click();
  await page.locator("#csv").fill([
    "date,label,week_type,exercise,sets,reps,load,target_rpe,group",
    `${today()},Lower,normal,Back squat,4,5,85%,8,`,
    `${today()},Lower,normal,Romanian deadlift,3,8,70%,7,`,
    `${today()},Lower,normal,Back squat,5,5,85%,8,Reserves`,
    `${today()},Lower,normal,Nordics,3,5,BW,8,Reserves`,
  ].join("\n"));
  await page.getByRole("button", { name: /replace program/i }).click();
  await expect(page.getByText("Group: Reserves")).toBeVisible();
  await expect(page.getByText("Everyone", { exact: true }).first()).toBeVisible();

  await addPlayer(page, "Reserve One");
  await addPlayer(page, "Starter One");
  await page.goto("/coach/squad");
  await page.getByLabel("Select Reserve One").check();
  await page.locator("#group").fill("Reserves");
  await page.getByRole("button", { name: "Set group for ticked players" }).click();
  await expect(page.getByText("1 player now in Reserves.")).toBeVisible();
  await expect(page.locator("section#players").getByText("Reserves").first()).toBeVisible();

  // Players are listed alphabetically: Reserve One, then Starter One.
  const reserve = await newPhone(browser);
  await reserve.page.goto(await playerLink(page, 0));
  await agreeAndClaim(reserve.page);
  await expect(reserve.page.getByText("Reserve One")).toBeVisible();
  await expect(reserve.page.locator("tr", { hasText: "Nordic hamstring curl" })).toBeVisible();
  await expect(reserve.page.locator("tr", { hasText: "Back squat" })).toContainText("5");

  const starter = await newPhone(browser);
  await starter.page.goto(await playerLink(page, 1));
  await agreeAndClaim(starter.page);
  await expect(starter.page.getByText("Starter One")).toBeVisible();
  await expect(starter.page.locator("tr", { hasText: "Romanian deadlift" })).toBeVisible();
  await expect(starter.page.locator("tr", { hasText: "Nordic hamstring curl" })).toHaveCount(0);

  // Today shows the reserve's group beside their name, and a header that says there are two versions.
  await page.goto("/coach");
  await expect(page.getByText("2 versions today")).toBeVisible();
  await expect(page.getByRole("link", { name: /Reserve One/ })).toContainText("Reserves");
  await reserve.ctx.close(); await starter.ctx.close();
});

test("a coach changes one player's plan: the player, the rules and the coach's card all use it, and lifting puts it back", async ({ page, browser }) => {
  await signUp(page);
  await importProgram(page, [
    `${today()},Lower,normal,Back squat,4,5,85% 1RM,8`,
    `${today()},Lower,normal,Romanian deadlift,3,8,70% 1RM,7`,
  ]);
  await addPlayer(page, "Knee Player");
  await addPlayer(page, "Plain Player");
  const kneeLink = await playerLink(page, 0); // alphabetical: Knee, then Plain
  const plainLink = await playerLink(page, 1);
  const kneeCode = kneeLink.split("/").pop()!;

  await page.goto(`/coach/athletes/${kneeCode}`);
  await page.locator("#ov-exercise").selectOption("Back squat");
  await page.locator("#ov-swap").fill("Box squat");
  await page.locator("#ov-sets").fill("3");
  await page.locator("#ov-load").fill("80");
  await page.getByRole("button", { name: "Save change" }).click();
  await expect(page.getByText(/Saved\. Knee now has this change/)).toBeVisible();
  await expect(page.getByText("Back squat: swap to Box squat, max 3 sets, 80% of planned load")).toBeVisible();

  // A load below 50% is stopped by the browser before it is sent (the server checks again; see the unit tests), and nothing is saved.
  await page.locator("#ov-exercise").selectOption("Romanian deadlift");
  await page.locator("#ov-load").fill("20");
  await page.getByRole("button", { name: "Save change" }).click();
  expect(await page.locator("#ov-load").evaluate((el) => (el as HTMLInputElement).validity.rangeUnderflow)).toBe(true);
  await expect(page.getByText("Romanian deadlift: ")).toHaveCount(0);
  await page.locator("#ov-load").fill("");

  // The player with the change sees it, labelled; the other player's plan is untouched.
  const knee = await newPhone(browser);
  await knee.page.goto(kneeLink);
  await agreeAndClaim(knee.page);
  const boxRow = knee.page.locator("tr", { hasText: "Box squat" });
  await expect(boxRow).toContainText("Changed for you by your coach");
  await expect(boxRow).toContainText("3");
  await expect(knee.page.locator("tr", { hasText: "Back squat" })).toHaveCount(0);
  await expect(knee.page.getByText("Your coach has set a personal change to this session for you.")).toBeVisible();
  const plain = await newPhone(browser);
  await plain.page.goto(plainLink);
  await agreeAndClaim(plain.page);
  await expect(plain.page.locator("tr", { hasText: "Back squat" })).toBeVisible();
  await expect(plain.page.locator("tr", { hasText: "Box squat" })).toHaveCount(0);
  await expect(plain.page.getByText("Changed for you by your coach")).toHaveCount(0);

  // High soreness makes the rules trim the main lift. They must work from the changed plan: Box squat, 3 sets of 5.
  await knee.page.locator('input[name="sleep_h"]').fill("7");
  await pick(knee.page, "soreness", 7);
  await pick(knee.page, "stress", 2);
  await knee.page.getByRole("button", { name: "Send check-in" }).click();
  await expect(knee.page.getByText("Your coach is reviewing")).toBeVisible({ timeout: 20_000 });
  await page.goto("/coach");
  await expect(page.getByText("This is Knee’s own plan: you changed Box squat for them.")).toBeVisible();
  const proposalRow = page.locator("tr", { hasText: "Box squat" }).first();
  await expect(proposalRow).toContainText("80% of 85% 1RM"); // the load the coach set, not the program's
  await expect(page.locator("tr", { hasText: "Back squat" })).toHaveCount(0); // no table on Today shows the unchanged lift

  // A review date of today puts a reminder on Today.
  await page.goto(`/coach/athletes/${kneeCode}`);
  // A brand-new player has no usual range yet, and the page says so instead of inventing one.
  await expect(page.getByText("Today against their own usual")).toBeVisible();
  await expect(page.getByText("Not enough history yet to compare.")).toHaveCount(3);
  await page.locator("#ov-exercise").selectOption("Romanian deadlift");
  await page.locator("#ov-swap").fill("Hip thrust");
  await page.locator("#ov-review").fill(today());
  await page.getByRole("button", { name: "Save change" }).click();
  await expect(page.getByText(/Saved\. Knee now has this change/)).toBeVisible();
  await page.goto("/coach");
  await expect(page.getByText(/Plan changes to review/)).toContainText("Knee Player (Romanian deadlift)");

  // Lifting puts the player back on the program.
  await page.goto(`/coach/athletes/${kneeCode}`);
  for (let n = 0; n < 2; n++) {
    await page.getByRole("button", { name: "Lift", exact: true }).first().click();
    await expect(page.getByText("Lifted. The player is back on the program.")).toBeVisible();
  }
  await expect(page.getByText("No personal changes.")).toBeVisible();
  await knee.page.reload();
  await expect(knee.page.locator("tr", { hasText: "Back squat" })).toBeVisible();
  await expect(knee.page.locator("tr", { hasText: "Box squat" })).toHaveCount(0);
  await knee.ctx.close(); await plain.ctx.close();
});

test("a new coach loads a sample squad, tries a player's phone, and removes it all", async ({ page, browser }) => {
  await signUp(page);
  await page.getByRole("button", { name: "Load a sample squad" }).click();
  // The words appear in the notice and again in the Activity feed; both are right, so look for each once.
  await expect(page.getByText(/Sample squad loaded: 6 fictional players and a sample program/)).toBeVisible();
  await expect(page.getByText("Sample squad loaded: 6 fictional players with two weeks of history")).toBeVisible();
  await expect(page.getByText(/You are looking at a/)).toBeVisible();
  await expect(page.getByText("2 versions today")).toBeVisible();

  // The rules ran for real on the sample answers: a pain note is a flag, short sleep is a proposal.
  await expect(page.getByRole("heading", { name: "Check before training" })).toBeVisible();
  await expect(page.getByText("Mensah").first()).toBeVisible();
  await expect(page.getByText("Sample").first()).toBeVisible();

  // Try a player's phone: Reid is in Reserves, has a standing plan change, and has not checked in.
  await page.goto("/coach/squad");
  await expect(page.getByText(/6 fictional players are mixed into this squad/)).toBeVisible();
  const href = await page.getByRole("link", { name: "Try as this player" }).first().getAttribute("href");
  const phone = await newPhone(browser);
  await phone.page.goto(href!);
  await agreeAndClaim(phone.page);
  await expect(phone.page.getByText("Reid")).toBeVisible();
  const slider = phone.page.locator("tr", { hasText: "Hamstring slider curl" });
  await expect(slider).toContainText("Changed for you by your coach");
  await expect(phone.page.locator("tr", { hasText: "Box jump" })).toBeVisible(); // the Reserves version of the session
  await expect(phone.page.getByRole("button", { name: "Send check-in" })).toBeVisible();
  await phone.ctx.close();

  // Remove it all. Confirmation is required.
  await page.getByRole("button", { name: "Remove sample squad" }).click(); // the box is required, so the browser stops this
  await expect(page.getByText(/6 fictional players are mixed into this squad/)).toBeVisible();
  await page.getByLabel("Remove the sample squad").check();
  await page.getByRole("button", { name: "Remove sample squad" }).click();
  await expect(page.getByText(/Removed the sample squad \(6 players\)/)).toBeVisible();
  await page.goto("/coach/squad");
  await expect(page.getByText("Mensah")).toHaveCount(0);
  await expect(page.getByText("No players yet.")).toBeVisible();
  await page.goto("/coach");
  await expect(page.getByRole("button", { name: "Load a sample squad" })).toBeVisible(); // can be loaded again
});


test("a coach pastes a program, checks what was read, changes it in words, and only then do players get it", async ({ page }) => {
  await signUp(page);
  await page.goto("/coach/program");
  await page.locator("#program_text").fill("Mon lower: squat 4x5, RDL 3x8\nWed upper: bench 4x6\nFri Reserves: split squat 3x8");
  await page.getByRole("button", { name: "Read my program" }).click();
  await page.waitForURL(/\/coach\/program\/review\//);
  await expect(page.getByText("Nothing has reached your players yet")).toBeVisible();
  await expect(page.getByText("Back squat")).toBeVisible();

  // The revision is done in words and adds a session.
  await page.locator("#instruction").fill("Reserves also train on Tuesday");
  await page.getByRole("button", { name: "Change it" }).click();
  await expect(page.getByText("Conditioning legs")).toBeVisible();

  // Nothing is live until the coach says so.
  await page.goto("/coach/program");
  await expect(page.getByText("Conditioning legs")).toHaveCount(0);
  await page.goBack();
  await page.getByRole("button", { name: "Use this program" }).click();
  await expect(page.getByText(/Saved 4 sessions/)).toBeVisible();
  await expect(page.getByText("Conditioning legs")).toBeVisible();
});

test("fixtures are read as a coach writes them", async ({ page }) => {
  await signUp(page);
  await page.goto("/coach/program");
  await page.locator("#fixtures").fill("Sat 11 Oct 2026 v Reading (H)\n18/10/2026\nnothing here");
  await page.getByRole("button", { name: "Save fixtures" }).click();
  await expect(page.getByText(/Saved 2 match dates/)).toBeVisible();
  await expect(page.locator("#fixtures")).toHaveValue("2026-10-11\n2026-10-18");
});

test("results show an empty state for a new club", async ({ page }) => {
  await signUp(page);
  await page.getByRole("link", { name: "Results" }).first().click();
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await expect(page.getByText("Sample players are not counted.")).toBeVisible();
});
