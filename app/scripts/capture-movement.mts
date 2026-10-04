// Turns the landmarks that tools/pose-capture/detect.py found in a video into a figure, and writes a page to review it.
//
//   npx tsx scripts/capture-movement.mts OUTDIR META.json [--write]
//
// OUTDIR holds landmarks.json and frames/ from detect.py. This writes OUTDIR/movement.json and OUTDIR/review.html and prints what to check.
// With --write the figure is also saved into src/lib/movement/data and the list of figures is regenerated. It is saved as unreviewed.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { capture, type CaptureMeta, type Source } from "../src/lib/movement/capture";
import { interpolate } from "../src/lib/movement/pose";
import type { Movement, Pose } from "../src/lib/movement/types";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "../src/lib/movement/data");
const args = process.argv.slice(2);
const write = args.includes("--write");
const [outArg, metaArg] = args.filter((a) => !a.startsWith("--"));
if (!outArg || !metaArg) { console.error("Usage: npx tsx scripts/capture-movement.mts OUTDIR META.json [--write]"); process.exit(1); }
const out = resolve(outArg);
const source = JSON.parse(readFileSync(join(out, "landmarks.json"), "utf8")) as Source;
const meta = JSON.parse(readFileSync(resolve(metaArg), "utf8")) as CaptureMeta;

const result = capture(source, meta);
const { movement: m, report: r, warnings } = result;
writeFileSync(join(out, "movement.json"), JSON.stringify(m, null, 1));

// ---------- the review page
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const line = (p: Pose, names: (keyof Pose)[], dx = 0) => "M" + names.map((n) => `${(p[n][0] + dx).toFixed(1)} ${p[n][1].toFixed(1)}`).join(" L");
const body = (p: Pose) => `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${line(p, ["hip", "knee", "ankle", "toe"], -9)}" stroke="#14231d" stroke-width="6" opacity=".35"/><path d="${line(p, ["neck", "elbow", "wrist"], -7)}" stroke="#14231d" stroke-width="5" opacity=".35"/><path d="${line(p, ["neck", "hip"])}" stroke="#0f6b4f" stroke-width="10"/><path d="${line(p, ["hip", "knee", "ankle", "toe"])}" stroke="#14231d" stroke-width="7"/><path d="${line(p, ["neck", "elbow", "wrist"])}" stroke="#14231d" stroke-width="6"/><circle cx="${p.head[0]}" cy="${p.head[1]}" r="15" fill="#f6f7f2" stroke="#14231d" stroke-width="5"/></g>`;
const stage = (mv: Movement, inner: string, width = "100%", id = "") => {
  const s = mv.scene;
  return `<svg ${id ? `id="${id}"` : ""} viewBox="0 20 ${s.width} ${s.height - 40}" width="${width}" style="background:#fff;border:1px solid #e1e6dc;border-radius:8px"><line x1="14" y1="${s.ground}" x2="${s.width - 14}" y2="${s.ground}" stroke="#c6cfc0" stroke-width="2"/>${s.box ? `<rect x="${s.box.x}" y="${s.box.y}" width="${s.box.w}" height="${s.ground - s.box.y}" rx="4" fill="#e2f1e9" stroke="#c6cfc0" stroke-width="2"/>` : ""}${s.pad ? `<rect x="${s.pad.x}" y="${s.pad.y}" width="${s.pad.w}" height="${s.ground - s.pad.y}" rx="4" fill="#c6cfc0"/>` : ""}${inner}</svg>`;
};
const THUMB_W = 360, thumbH = Math.round((source.height * THUMB_W) / source.width), every = source.thumbEvery ?? 3;
const L = { left: { hip: 23, knee: 25, ankle: 27, toe: 31, neck: 11, head: 7, elbow: 13, wrist: 15 }, right: { hip: 24, knee: 26, ankle: 28, toe: 32, neck: 12, head: 8, elbow: 14, wrist: 16 } }[r.side];
const photo = (i: number) => {
  const f = source.frames[i];
  const near = Math.round(i / every) * every;
  const pts = f?.lm ? (Object.entries(L) as [string, number][]).map(([j, n]) => [j, f.lm![n][0] * THUMB_W, f.lm![n][1] * thumbH] as const) : [];
  const P = Object.fromEntries(pts.map(([j, x, y]) => [j, [x, y]]));
  const seg = (a: string, b: string) => (P[a] && P[b] ? `<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}" stroke="#d7ff3f" stroke-width="3"/>` : "");
  return `<svg viewBox="0 0 ${THUMB_W} ${thumbH}" width="100%" style="border-radius:8px;background:#222"><image href="frames/f_${near}.jpg" width="${THUMB_W}" height="${thumbH}"/>${seg("hip", "neck")}${seg("hip", "knee")}${seg("knee", "ankle")}${seg("ankle", "toe")}${seg("neck", "elbow")}${seg("elbow", "wrist")}${pts.map(([, x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#0f6b4f" stroke="#fff" stroke-width="1.5"/>`).join("")}</svg>`;
};
const cards = m.keyframes.map((k, n) => {
  const kk = r.keyframes[n];
  return `<div class="card"><div class="cap">Key ${n + 1} · t=${k.t} · video ${kk.sourceTime.toFixed(2)} s${k.contact ? " · foot planted" : ""}</div><div class="pair">${photo(kk.sourceIndex)}${stage(m, body(k.pose))}</div></div>`;
}).join("");
const frames = Array.from({ length: 90 }, (_, i) => interpolate(m.keyframes, i / 89));
const maxY = Math.max(...r.hipHeight.map((h) => h.y), 1), minY = Math.min(...r.hipHeight.map((h) => h.y), 0);
const cx = (t: number) => 20 + t * 560, cy = (y: number) => 130 - ((y - minY) / (maxY - minY || 1)) * 110;
const chart = `<svg viewBox="0 0 600 150" width="100%" style="background:#fff;border:1px solid #e1e6dc;border-radius:8px"><polyline fill="none" stroke="#0f6b4f" stroke-width="2" points="${r.hipHeight.map((h) => `${cx(h.t).toFixed(1)},${cy(h.y).toFixed(1)}`).join(" ")}"/>${m.keyframes.map((k) => `<line x1="${cx(k.t)}" x2="${cx(k.t)}" y1="10" y2="135" stroke="#c6cfc0"/><text x="${cx(k.t)}" y="146" font-size="9" text-anchor="middle" fill="#52625a">${k.t}</text>`).join("")}${m.phases.map((p) => `<line x1="${cx(p.from)}" x2="${cx(p.from)}" y1="10" y2="135" stroke="#d98a00" stroke-width="2"/><text x="${cx(p.from) + 4}" y="22" font-size="10" fill="#a35f08">${esc(p.label)}</text>`).join("")}</svg>`;
const html = `<!doctype html><meta charset="utf-8"><title>Review: ${esc(m.name)}</title>
<style>body{font:15px system-ui;background:#f6f7f2;color:#14231d;margin:0;padding:24px;max-width:1100px}h1{margin:0 0 4px}.w{background:#fdf0d8;color:#8a5006;border-radius:8px;padding:10px 14px;margin:8px 0}.ok{background:#e0f3e8;color:#1d8a52;border-radius:8px;padding:10px 14px;margin:8px 0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px}.card{background:#fff;border:1px solid #e1e6dc;border-radius:12px;padding:10px}.cap{font:12px ui-monospace,monospace;color:#52625a;margin-bottom:6px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}table td{padding:2px 14px 2px 0}h2{margin:26px 0 8px;font-size:17px}code{background:#eef1e8;padding:1px 5px;border-radius:4px}</style>
<h1>${esc(m.name)}</h1><div style="color:#52625a">${esc(m.id)} · captured · not reviewed</div>
${warnings.length ? warnings.map((w) => `<div class="w">${esc(w)}</div>`).join("") : '<div class="ok">No warnings.</div>'}
<table><tr><td>Side facing the camera</td><td>${r.side}${r.mirrored ? " (mirrored so the figure moves right)" : ""}</td></tr><tr><td>Part of the video used</td><td>${r.startS.toFixed(2)} s to ${r.endS.toFixed(2)} s (${r.realDurationS.toFixed(2)} s)</td></tr><tr><td>Keyframes</td><td>${m.keyframes.length}, worst fit ${r.maxFitErrorPx} units</td></tr><tr><td>Detector confidence</td><td>${r.meanVisibility.toFixed(2)}</td></tr><tr><td>Figure plays for</td><td>${m.durationMs} ms</td></tr></table>
<h2>Preview</h2><div style="max-width:520px">${stage(m, "", "100%", "prev")}</div><div><button id="pp">Pause</button> <span id="ph" style="font:12px ui-monospace"></span></div>
<h2>Hip height over the movement</h2>${chart}<p style="color:#52625a;margin:4px 0">Grey lines are keyframes. Orange lines are where each phase starts in <code>meta.phases</code>: move them to the moment the phase begins, then run the command again.</p>
<h2>Each keyframe: the video frame with the detected joints, and the figure we would draw</h2><div class="grid">${cards}</div>
<h2>Check before using</h2><ul><li>Does each figure match the person in the same frame (leg bent the same way, arms in the same place)?</li><li>Is the preview the movement you would teach, and are the phase names where they belong?</li><li>If a key looks wrong, trim to one clean rep with <code>startS</code> and <code>endS</code>, or raise <code>maxKeyframes</code>, and run it again.</li><li>Only then run it with <code>--write</code>. The figure is saved as unreviewed; a sports scientist signs it off before <code>reviewed</code> is changed.</li></ul>
<script>
const F=${JSON.stringify(frames)},PH=${JSON.stringify(m.phases)},D=${m.durationMs};
const line=(p,n,dx=0)=>"M"+n.map(k=>(p[k][0]+dx).toFixed(1)+" "+p[k][1].toFixed(1)).join(" L");
const body=p=>'<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="'+line(p,["hip","knee","ankle","toe"],-9)+'" stroke="#14231d" stroke-width="6" opacity=".35"/><path d="'+line(p,["neck","elbow","wrist"],-7)+'" stroke="#14231d" stroke-width="5" opacity=".35"/><path d="'+line(p,["neck","hip"])+'" stroke="#0f6b4f" stroke-width="10"/><path d="'+line(p,["hip","knee","ankle","toe"])+'" stroke="#14231d" stroke-width="7"/><path d="'+line(p,["neck","elbow","wrist"])+'" stroke="#14231d" stroke-width="6"/><circle cx="'+p.head[0]+'" cy="'+p.head[1]+'" r="15" fill="#f6f7f2" stroke="#14231d" stroke-width="5"/></g>';
const svg=document.getElementById("prev"),g=document.createElementNS("http://www.w3.org/2000/svg","g");svg.appendChild(g);
let on=true,start=performance.now();document.getElementById("pp").onclick=e=>{on=!on;e.target.textContent=on?"Pause":"Play";start=performance.now()};
(function tick(now){if(on){const t=Math.min(1,((now-start)%(D+700))/D);const i=Math.round(t*(F.length-1));g.innerHTML=body(F[i]);const p=PH.find(x=>t>=x.from&&t<x.to)||PH[PH.length-1];document.getElementById("ph").textContent=p.label}requestAnimationFrame(tick)})(performance.now());
</script>`;
writeFileSync(join(out, "review.html"), html);

// ---------- what to do next
console.log(`\n${m.name}: ${m.keyframes.length} keyframes from ${r.realDurationS.toFixed(2)} s of video (${r.startS.toFixed(2)} s to ${r.endS.toFixed(2)} s), worst fit ${r.maxFitErrorPx} units.`);
for (const w of warnings) console.log(`  ! ${w}`);
console.log(`Review: open ${join(out, "review.html")}`);
if (write) {
  writeFileSync(join(dataDir, `${m.id}.json`), JSON.stringify(m, null, 1));
  const files = readdirSync(dataDir).filter((f) => f.endsWith(".json")).sort();
  const names = files.map((f) => f.replace(/\.json$/, ""));
  const ident = (n: string) => n.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
  writeFileSync(join(dataDir, "index.ts"), `// Generated by scripts/capture-movement.mts --write. Lists every movement in this folder.\nimport type { Movement } from "../types";\n${names.map((n) => `import ${ident(n)} from "./${n}.json";`).join("\n")}\n\nexport const ALL = [${names.map(ident).join(", ")}] as unknown as Movement[];\n`);
  console.log(`Saved src/lib/movement/data/${m.id}.json (unreviewed) and regenerated data/index.ts.`);
} else {
  console.log("Not saved. Run again with --write when the review looks right.");
}
