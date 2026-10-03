import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hasAccess, paidClubFrom, verifyStripe } from "./billing";

const club = { id: "abc123", paid_at: null };
describe("hasAccess", () => {
  it("lets everyone in when there is no payment link", () => expect(hasAccess(club, { link: null, comped: undefined })).toBe(true));
  it("keeps an unpaid club out when there is a link", () => expect(hasAccess(club, { link: "https://x", comped: undefined })).toBe(false));
  it("lets a paid club in", () => expect(hasAccess({ ...club, paid_at: "2026-10-01" }, { link: "https://x", comped: undefined })).toBe(true));
  it("lets a comped club in", () => expect(hasAccess(club, { link: "https://x", comped: "ffffff, abc123" })).toBe(true));
});

describe("verifyStripe", () => {
  const body = '{"a":1}', secret = "whsec_test", now = 1_800_000_000_000;
  const sig = (t: number, b = body, s = secret) => `t=${t},v1=${createHmac("sha256", s).update(`${t}.${b}`).digest("hex")}`;
  it("accepts a correct, fresh signature", () => expect(verifyStripe(body, sig(now / 1000), secret, now)).toBe(true));
  it("rejects a wrong secret, a changed body, a stale time and no header", () => {
    expect(verifyStripe(body, sig(now / 1000, body, "other"), secret, now)).toBe(false);
    expect(verifyStripe(body + " ", sig(now / 1000), secret, now)).toBe(false);
    expect(verifyStripe(body, sig(now / 1000 - 3600), secret, now)).toBe(false);
    expect(verifyStripe(body, null, secret, now)).toBe(false);
  });
});

describe("paidClubFrom", () => {
  const ev = (o: object, type = "checkout.session.completed") => ({ type, data: { object: o } });
  it("returns the club of a paid checkout", () => expect(paidClubFrom(ev({ client_reference_id: "abc123", payment_status: "paid" }))).toBe("abc123"));
  it("ignores unpaid, other events, and references that are not a club", () => {
    expect(paidClubFrom(ev({ client_reference_id: "abc123", payment_status: "unpaid" }))).toBeNull();
    expect(paidClubFrom(ev({ client_reference_id: "abc123", payment_status: "paid" }, "charge.refunded"))).toBeNull();
    expect(paidClubFrom(ev({ client_reference_id: "nope", payment_status: "paid" }))).toBeNull();
  });
});
