import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PASSWORD, uniq } from "./helpers";

// Runs only with a payment link set (npm run test:e2e:gate), because the gate is off without one.
test.skip(!process.env.NEXT_PUBLIC_PAYMENT_LINK, "needs NEXT_PUBLIC_PAYMENT_LINK");

test("an unpaid club is held at Subscribe until Stripe's signed webhook says it paid", async ({ page, request }) => {
  await page.goto("/signup");
  await page.locator("#club").fill(`Gate FC ${uniq()}`);
  await page.locator("#name").fill("Alex Coach");
  await page.locator("#email").fill(`coach-${uniq()}@e2e.test`);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("form button").click();
  await page.waitForURL(/\/subscribe$/);
  await expect(page).toHaveURL(/\/subscribe$/);
  const href = await page.getByRole("link", { name: "Subscribe" }).getAttribute("href");
  expect(href).toContain("client_reference_id=");
  const id = new URL(href!).searchParams.get("client_reference_id")!;

  const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { client_reference_id: id, payment_status: "paid" } } });
  const t = Math.floor(Date.now() / 1000);
  const good = `t=${t},v1=${createHmac("sha256", "whsec_e2e").update(`${t}.${body}`).digest("hex")}`;

  expect((await request.post("/api/stripe/webhook", { data: body, headers: { "stripe-signature": "t=1,v1=bad" } })).status()).toBe(400);
  await page.goto("/coach");
  await expect(page).toHaveURL(/\/subscribe$/);

  expect((await request.post("/api/stripe/webhook", { data: body, headers: { "stripe-signature": good } })).status()).toBe(200);
  await page.goto("/coach");
  await expect(page).toHaveURL(/\/coach$/);
});
