// Records a narrated demo of the app as it is today, against a running dev server and the Firestore emulator.
// Usage: DEMO_OUT=/path/to/dir PW_CHROMIUM=/path/to/chrome npx tsx scripts/record-demo.mts   (see scripts/record-demo.sh)
// Captions are drawn into the page, the voice is the macOS `say` command, and ffmpeg joins the three recordings
// (coach's screen, the player's phone, the coach's screen again) with the voice laid over them.
import { chromium, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.DEMO_BASE ?? "http://localhost:3140";
const OUT = process.env.DEMO_OUT ?? "demo-out";
const VOICE = process.env.DEMO_VOICE ?? "Daniel";
mkdirSync(join(OUT, "audio"), { recursive: true });

// ---- voice -------------------------------------------------------------------------------------------------------
const spoken = new Map<string, { file: string; dur: number }>();
function voice(text: string) {
  const hit = spoken.get(text);
  if (hit) return hit;
  const file = join(OUT, "audio", `l${spoken.size}.aiff`);
  execFileSync("say", ["-v", VOICE, "-r", "168", "-o", file, text]);
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
  const v = { file, dur };
  spoken.set(text, v);
  return v;
}

// ---- captions, cursor, pointing ---------------------------------------------------------------------------------
const OVERLAY = `(() => {
  const phone = innerWidth < 600;
  const css = document.createElement("style");
  css.textContent = "#__cap{position:fixed;left:50%;bottom:" + (phone ? 12 : 24) + "px;transform:translateX(-50%);z-index:2147483647;max-width:" + (phone ? "94vw" : "min(1000px,92vw)") + ";background:rgba(10,18,13,.92);color:#fff;font:600 " + (phone ? 14 : 22) + "px/1.35 system-ui,sans-serif;padding:" + (phone ? "10px 14px" : "14px 22px") + ";border-radius:12px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35);pointer-events:none}#__dot{position:fixed;z-index:2147483646;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(245,197,66,.55);border:2px solid #f5c542;pointer-events:none;transition:transform .08s}";
  const put = () => {
    if (document.getElementById("__cap")) return;
    document.head.appendChild(css);
    const c = document.createElement("div"); c.id = "__cap"; document.documentElement.appendChild(c);
    const d = document.createElement("div"); d.id = "__dot"; d.style.display = "none"; document.documentElement.appendChild(d);
    const t = sessionStorage.getItem("__capText"); c.textContent = t || ""; c.style.display = t ? "block" : "none";
  };
  window.__cap = (t) => { put(); sessionStorage.setItem("__capText", t); const c = document.getElementById("__cap"); c.textContent = t; c.style.display = t ? "block" : "none"; };
  addEventListener("mousemove", (e) => { put(); const d = document.getElementById("__dot"); d.style.display = "block"; d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; }, true);
  addEventListener("mousedown", () => { const d = document.getElementById("__dot"); if (d) d.style.transform = "scale(.7)"; }, true);
  addEventListener("mouseup", () => { const d = document.getElementById("__dot"); if (d) d.style.transform = ""; }, true);
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", put); else put();
})();`;

type Cue = { at: number; file: string };
type Seg = { page: Page; t0: number; cues: Cue[] };
const wait = (s: Seg, ms: number) => s.page.waitForTimeout(ms);

// Says a line over the picture while `fn` runs, and holds until the line has finished.
async function during(s: Seg, text: string, fn: () => Promise<unknown> = async () => {}) {
  const v = voice(text);
  await s.page.evaluate((t) => (window as unknown as { __cap: (t: string) => void }).__cap(t), text).catch(() => {});
  s.cues.push({ at: (Date.now() - s.t0) / 1000, file: v.file });
  const end = Date.now() + v.dur * 1000 + 450;
  await fn();
  const rest = end - Date.now();
  if (rest > 0) await s.page.waitForTimeout(rest);
}

async function glide(s: Seg, el: Locator) {
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  if (b) await s.page.mouse.move(b.x + Math.min(b.width / 2, 120), b.y + b.height / 2, { steps: 22 });
}
async function click(s: Seg, el: Locator) {
  await glide(s, el);
  await wait(s, 220);
  await el.click();
}
async function type(s: Seg, el: Locator, text: string) {
  await glide(s, el);
  await el.click();
  await el.pressSequentially(text, { delay: 42 });
}
async function show(s: Seg, el: Locator, block: "start" | "center" = "center") {
  await el.evaluate((e, b) => e.scrollIntoView({ behavior: "smooth", block: b as ScrollLogicalPosition }), block);
  await wait(s, 700);
}
async function point(s: Seg, el: Locator, ms = 1800) {
  await el.evaluate((e) => { const h = e as HTMLElement; h.dataset.o = h.style.outline; h.style.outline = "3px solid #f5c542"; h.style.outlineOffset = "4px"; });
  await wait(s, ms);
  await el.evaluate((e) => { const h = e as HTMLElement; h.style.outline = h.dataset.o ?? ""; }).catch(() => {});
}

// ---- the story ---------------------------------------------------------------------------------------------------
const chrome = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(chrome);
const deskCtx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: join(OUT, "v-desk"), size: { width: 1280, height: 720 } } });
await deskCtx.addInitScript(OVERLAY);
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 780 }, recordVideo: { dir: join(OUT, "v-phone"), size: { width: 390, height: 780 } } });
await phoneCtx.addInitScript(OVERLAY);

const seg = async (ctx: typeof deskCtx): Promise<Seg> => ({ page: await ctx.newPage(), t0: Date.now(), cues: [] });
const done: { path: string; cues: Cue[]; phone: boolean }[] = [];
const finish = async (s: Seg, phone = false) => { const v = s.page.video()!; await s.page.close(); done.push({ path: await v.path(), cues: s.cues, phone }); };

const unique = Date.now().toString(36);
let playerHref = "";

// Part 1: the coach's morning, from sign-up to a squad on screen.
const a = await seg(deskCtx);
await a.page.goto(`${BASE}/`);
await during(a, "This is RepReady as it is built today. Players check in each morning. Written rules propose at most one small change to a session, and the coach decides. Here is a normal day.", () => wait(a, 5000));
await a.page.goto(`${BASE}/signup`);
await during(a, "A new coach creates a club account with an email and a password.", async () => {
  await type(a, a.page.locator("#club"), "Northgate FC");
  await type(a, a.page.locator("#name"), "Alex Coach");
  await type(a, a.page.locator("#email"), `alex-${unique}@demo.test`);
  await type(a, a.page.locator("#password"), "demo-password-123");
  await click(a, a.page.locator("form button"));
  await a.page.waitForURL(/\/coach$/);
});
await during(a, "Day one is four steps: add players, import the program, get players onto their phones, and receive the first check-in. To see it working first, the coach loads a sample squad.", async () => {
  await wait(a, 1500);
  await click(a, a.page.getByRole("button", { name: "Load a sample squad" }));
  await a.page.getByText(/You are looking at a/).waitFor();
});
await during(a, "Six fictional players, two weeks of answers, two groups, and a standing plan change. It is labelled as sample, and one click removes it.", async () => {
  await a.page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await wait(a, 1800);
});
await during(a, "Today is the whole morning on one screen: how many players have answered, how many need a decision, and what the agent has already adjusted.", async () => {
  const summary = a.page.getByRole("region", { name: "Summary" });
  await show(a, summary);
  await point(a, summary, 2200);
});
await during(a, "Each card is one proposal. It shows the rule that fired, the numbers it saw, and the exact change. At most one per player, always inside limits that are kept in code.", async () => {
  const needs = a.page.getByRole("heading", { name: "Needs you" });
  await show(a, needs, "start");
  await wait(a, 3500);
});
const pain = a.page.getByRole("heading", { name: "Check before training" });
if (await pain.count()) {
  await during(a, "A pain note is different. The rules stop, make no edit, and flag it for the coach to clear.", async () => {
    await show(a, pain, "start");
    await point(a, pain, 2500);
  });
}
const routineBtn = a.page.getByRole("button", { name: /^Approve these \d+/ });
if (await routineBtn.count()) {
  await during(a, "Small routine trims of the same kind can be approved together in one tap. Anything else stays here for the coach.", async () => {
    await show(a, routineBtn);
    await point(a, routineBtn, 1600);
    await click(a, routineBtn);
    await wait(a, 1500);
  });
}
await a.page.goto(`${BASE}/coach/squad?view=people`);
await during(a, "Every player gets a personal link to send on WhatsApp. There is also a button to try the app as that player, which is what we do next.", async () => {
  const link = a.page.getByRole("link", { name: "Try as this player" }).first();
  await show(a, link);
  playerHref = (await link.getAttribute("href"))!;
  await point(a, link, 2000);
});
await finish(a);

// Part 2: the same morning on the player's phone.
const p = await seg(phoneCtx);
await p.page.goto(`${BASE}${playerHref}`);
await during(p, "Reid opens his personal link on his phone and agrees to the terms once. Players must be 18 or over.", async () => {
  const agree = p.page.locator('input[name="agree"]');
  if (await agree.count()) { await click(p, agree); await click(p, p.page.getByRole("button", { name: "Continue" })); }
  const claim = p.page.getByText("Use this phone for RepReady?");
  if (await claim.isVisible().catch(() => false)) await click(p, p.page.getByRole("button", { name: "Continue" }));
  await p.page.getByRole("button", { name: "Send check-in" }).waitFor();
});
await during(p, "His session is in front of him. His coach set a personal change on one exercise, and the session says so.", async () => {
  const row = p.page.locator("tr", { hasText: "Hamstring slider curl" });
  await show(p, row);
  await point(p, row, 2200);
});
await during(p, "Show me opens a slow, scrubbable side view with each phase named. These figures wait for a sports scientist to check them.", async () => {
  const row = p.page.locator("tr", { hasText: "Box jump" });
  await show(p, row);
  await click(p, row.getByRole("button", { name: "Show me" }));
  const sheet = p.page.getByRole("dialog", { name: "How to do Box jump" });
  await sheet.waitFor();
  await wait(p, 1800);
  await click(p, sheet.getByRole("button", { name: "Pause" }));
  await sheet.getByRole("slider", { name: "Position in the movement" }).fill("0.3");
  await wait(p, 1500);
  await click(p, sheet.getByRole("button", { name: "Close" }));
});
await during(p, "The check-in takes under a minute: sleep, soreness, stress, and a note if something is wrong. Reid slept badly and is sore.", async () => {
  await show(p, p.page.locator("#sleep_h"));
  await type(p, p.page.locator("#sleep_h"), "5");
  await click(p, p.page.locator('label:has(input[name="soreness"][value="7"])'));
  await click(p, p.page.locator('label:has(input[name="stress"][value="8"])'));
  await type(p, p.page.locator("#note"), "Slept badly, legs feel heavy");
  await click(p, p.page.getByRole("button", { name: "Send check-in" }));
  await p.page.getByText(/Got it|Your coach is reviewing|All good/).first().waitFor({ timeout: 30_000 });
});
await during(p, "The rules read it straight away. Reid sees that his coach is reviewing, and the session stays as planned until the coach decides.", () => wait(p, 1500));
await finish(p, true);

// Part 3: back on the coach's screen.
const b = await seg(deskCtx);
await b.page.goto(`${BASE}/coach`);
await during(b, "On the coach's screen a new card has appeared by itself, with the rule and the numbers from Reid's check-in.", async () => {
  const card = b.page.getByText("Reid", { exact: true }).first();
  await card.waitFor({ timeout: 20_000 });
  await show(b, card, "start");
  await wait(b, 3000);
});
await during(b, "Instead of clicking around, the coach can ask. The buttons answer from stored data and never touch a language model.", async () => {
  await b.page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await wait(b, 800);
  await click(b, b.page.getByRole("button", { name: "Who needs me?" }));
  await b.page.getByText(/waiting for you/).first().waitFor();
});
const ask = async (text: string, then: () => Promise<unknown>, button = "Ask") => {
  await type(b, b.page.locator("#ask-q"), text);
  await click(b, b.page.getByRole("button", { name: button, exact: true }));
  await then();
};
await during(b, "Or in the coach's own words. The model only names the request. Player names are replaced by codes before it reads the sentence, and the answer is written from stored data.", () =>
  ask("Why did you suggest a change for Reid?", async () => { await b.page.getByRole("status").getByRole("heading", { name: /Reid/ }).waitFor({ timeout: 40_000 }); await wait(b, 2200); }));
await during(b, "Anything that would change something shows a preview first. Here the coach reports match minutes in one line, and nothing is saved until Confirm.", () =>
  ask("Mensah 90, Ortiz 60 and Silva 25 yesterday", async () => {
    await b.page.getByText(/Save match minutes for/).waitFor({ timeout: 40_000 });
    await wait(b, 2200);
    await click(b, b.page.getByRole("button", { name: "Confirm" }));
    await b.page.getByText(/Saved minutes for/).waitFor();
  }));
await during(b, "A standing plan change works the same way, and goes through the same limits as the form on the player's page: reductions only, an exercise the player really has.", () =>
  ask("cap Reid's box jumps at 2 sets until Friday", async () => {
    await b.page.getByRole("status").getByRole("heading", { name: /Change .* plan/ }).waitFor({ timeout: 40_000 });
    await wait(b, 2200);
    await click(b, b.page.getByRole("button", { name: "Confirm" }));
    await b.page.getByText(/has this change/).waitFor();
  }));
await b.page.goto(`${BASE}/coach/squad`);
await during(b, "Squad shows every player against their own usual range, not the squad average. It shows who is trending down and who has gone quiet.", async () => {
  await wait(b, 3500);
});
await b.page.goto(`${BASE}/coach/squad`);
await during(b, "One player's page puts today against their usual range for sleep, soreness, stress and effort, with standing plan changes and what the rules suggested against what the coach did.", async () => {
  const link = b.page.getByRole("link", { name: /Mensah/ }).first();
  await click(b, link);
  await b.page.waitForURL(/\/coach\/athletes\//);
  await wait(b, 2000);
  await b.page.evaluate(() => window.scrollTo({ top: 600, behavior: "smooth" }));
  await wait(b, 2500);
});
await b.page.goto(`${BASE}/coach/program`);
await during(b, "Program holds the week around the match, the fixtures, and the minutes. Next week starts as a copy of this one for the coach to correct, and nothing goes live until the coach says so.", async () => {
  await wait(b, 4500);
});
await during(b, "The Agent page shows how much the agent does on its own. It starts by only suggesting. A rule can be handed over only after eight decisions in 28 days with nine in ten approved as proposed. Pain, illness, rest, swaps and increases are never automatic, and one switch pauses everything.", async () => {
  await click(b, b.page.getByRole("button", { name: /More/ }));
  await click(b, b.page.getByRole("menuitem", { name: "Agent" }));
  await b.page.waitForURL(/\/coach\/agent/);
  await wait(b, 2500);
  await b.page.evaluate(() => window.scrollTo({ top: 500, behavior: "smooth" }));
  await wait(b, 3000);
});
await during(b, "For the sports scientist, the Evaluation page scores the rules against the scientist's own judgement on thirty made-up players. The scientist decides each one first.", async () => {
  await click(b, b.page.getByRole("button", { name: /More/ }));
  await click(b, b.page.getByRole("menuitem", { name: "Evaluation" }));
  await b.page.waitForURL(/\/science\/evaluation/);
  await wait(b, 2500);
  await click(b, b.page.getByRole("link", { name: "Start with the first scenario" }));
  await b.page.waitForURL(/\/science\/label\/S01/);
});
await during(b, "Only after a decision is saved do the rule tags unlock, so the rules cannot steer the answer.", async () => {
  await b.page.locator("#decision").selectOption("none");
  await type(b, b.page.locator("#reason"), "Nothing in the last two weeks is outside this player's usual range.");
  await click(b, b.page.getByRole("button", { name: "Save decision" }));
  await b.page.getByText("Saved.").waitFor();
  await show(b, b.page.getByText("Which rules explain it?"));
  await wait(b, 1200);
});
await during(b, "Run scores the rules against those decisions in a second. Deleting a rule on the Rules page changes the result, which is how a scientist checks what each rule does.", async () => {
  await b.page.goto(`${BASE}/science/evaluation`);
  await click(b, b.page.getByRole("button", { name: /^Run on 1 decided/ }));
  await b.page.getByText(/Last run/).waitFor();
  await show(b, b.page.getByText(/Last run/));
  await wait(b, 2500);
});
await b.page.goto(`${BASE}/trust`);
await during(b, "The promises are written down for staff and players: what it does, what it never does, and where the data goes.", async () => {
  await wait(b, 2500);
  await b.page.evaluate(() => window.scrollTo({ top: 700, behavior: "smooth" }));
  await wait(b, 3000);
});
await during(b, "That is RepReady today. It is a pilot: a sports scientist has not yet reviewed the rules, and no club has used it yet.", () => wait(b, 1500));
await finish(b);
await browser.close();

// ---- join the recordings and the voice ------------------------------------------------------------------------
const dur = (f: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(done, null, 1));
const inputs: string[] = [];
const chains: string[] = [];
const delays: string[] = [];
const audioLabels: string[] = [];
const videoLabels: string[] = [];
let start = 0, n = 0;
for (const [i, d] of done.entries()) {
  inputs.push("-i", d.path);
  const vi = n++;
  chains.push(d.phone
    ? `[${vi}:v]fps=30,scale=-2:720,pad=1280:720:(ow-iw)/2:0:color=0x0e1511,setsar=1[v${i}]`
    : `[${vi}:v]fps=30,scale=1280:720,setsar=1[v${i}]`);
  videoLabels.push(`[v${i}]`);
  for (const c of d.cues) {
    inputs.push("-i", c.file);
    const ai = n++;
    const ms = Math.round((start + c.at) * 1000);
    delays.push(`[${ai}:a]adelay=${ms}|${ms}[a${ai}]`);
    audioLabels.push(`[a${ai}]`);
  }
  start += dur(d.path);
}
const graph = [...chains, `${videoLabels.join("")}concat=n=${done.length}:v=1:a=0[v]`, ...delays, `${audioLabels.join("")}amix=inputs=${audioLabels.length}:normalize=0:dropout_transition=0[a]`].join(";\n");
writeFileSync(join(OUT, "graph.txt"), graph);
execFileSync("ffmpeg", ["-y", ...inputs, "-filter_complex_script", join(OUT, "graph.txt"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", join(OUT, "repready-demo.mp4")], { stdio: "inherit" });
console.log(`Wrote ${join(OUT, "repready-demo.mp4")} (${Math.round(start)} s of picture)`);
