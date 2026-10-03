// A stand-in for the model provider, so the reading flow can be tested without a key, a network or a bill.
// It "reads" a fixed week; if the request carries a revision about Tuesday it adds a Tuesday Reserves session.
import http from "node:http";

const ex = (name, sets, reps, load) => ({ name, sets, reps, load, target_rpe: null });
const base = [
  { day: "Monday", date: null, label: "Lower strength", week_type: "normal", group: null, exercises: [ex("Back squat", 4, 5, "85%"), ex("Romanian deadlift", 3, 8, "70%")] },
  { day: "Wednesday", date: null, label: "Upper strength", week_type: "normal", group: null, exercises: [ex("Bench press", 4, 6, "80%")] },
  { day: "Friday", date: null, label: "Lower strength", week_type: "normal", group: "Reserves", exercises: [ex("Split squat", 3, 8, "RPE 7")] },
];

http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    // A player's name must never arrive here. If one does, fail loudly so the test catches it.
    if (/Adeyemi/i.test(raw)) { res.statusCode = 500; return res.end("name leaked to the model"); }
    let user = "";
    try { user = JSON.parse(raw).messages.find((m) => m.role === "user").content; } catch {}
    // Tests that need an exact program put it in the pasted text after FAKE_PROGRAM:, and the fake "reads" it back.
    const exact = user.match(/^FAKE_PROGRAM:(.+)$/m);
    if (exact) {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ sessions: JSON.parse(exact[1]), notes: [] }) } }] } }] }));
    }
    const sessions = /tuesday/i.test(user.split("\n").slice(-6).join("\n")) && /reserves/i.test(user)
      ? [...base, { day: "Tuesday", date: null, label: "Conditioning legs", week_type: "normal", group: "Reserves", exercises: [ex("Nordic curl", 3, 5, "BW")] }]
      : base;
    const args = JSON.stringify({ sessions, notes: ["Fake assistant: read a fixed week."] });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: args } }] } }] }));
  });
}).listen(Number(process.env.FAKE_LLM_PORT ?? 3199), "127.0.0.1");
