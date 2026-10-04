# Plan: make the app visual and alive (DRAFT, nothing built yet)

Sketch of the idea: https://claude.ai/artifact/Rnqf6bo4e8Hib6RqkWAo5L (animated box jump, drop jump and Nordic curl figures; three charts).

## The rule
Every screen answers its one question with a picture first and words second. Motion shows what changed and in what order. It never decorates, and it never runs when a person has asked for reduced motion.

## What exists today
`Spark` (7-day sleep line on Today), `Heat` (14-day squares on the player page), `SquadMapView`, `UsualToday`, `SessionTable` (changed values struck and highlighted), and exercise stills for exact library matches (two frames per exercise from free-exercise-db). Everything else is text. No page animates, apart from the landing page.

## 1. Motion system (small, first)
- One set of tokens in CSS: durations 150 / 300 / 600 ms, one easing curve, one stagger step (60 ms). Transform and opacity only.
- Four primitives: **Reveal** (list items rise in order), **CountUp** (numbers, tabular figures), **Flash** (a row that just changed, from the live poll), **Collapse** (an approved card folds away and reappears under "Handled for you").
- States: loading skeletons shaped like the real content, optimistic approve with a quiet undo, button press and focus feedback everywhere.
- Rules: honour `prefers-reduced-motion`, no motion longer than 700 ms except the hero-type sequences, nothing that moves while a person is typing.
- Page transitions with the browser's View Transitions API: try it on Today to Player and keep it only if it is smooth on a phone.

## 2. Charts and diagrams, by screen
Each is a small SVG component, drawn in once, with a text alternative and a visible "example" mark whenever it shows sample data. No chart library: the shapes we need (line with a band, bars, ring, timeline) are small, and a library would be bigger than the whole kit. (Reported sizes: Recharts about 150 KB gzipped, visx about 8 to 20 KB, uPlot about 20 KB. Our own SVG should be a few KB. Not measured by us.)

| Screen | Question it answers | Picture |
|---|---|---|
| Today | How many are in, who needs me? | Completion ring in the summary, squad strip of tiles that turn in as answers arrive |
| Player page | Is this player off their usual? | Line over a shaded "usual" band for sleep, then soreness, stress and effort against target |
| Squad | Who is drifting? | The existing map, with the same drawn-in order |
| Program | What is this week doing? | A week strip around the match: match day, gym days, changed sessions, match-day offsets |
| Agent | How much does it do for me? | Autonomy ladder with the current rung marked; each rule's approval record as a bar |
| Pain | Where does it hurt? | Body map, tap to mark; staff see it as a dot on the same figure |

Honest data only: charts draw what is stored. Load and minutes charts wait until that data exists.

## 3. Movement figures (the exercise animations)

### Options checked
| Option | Licence and cost | Verdict |
|---|---|---|
| free-exercise-db stills | Unlicense. Two frames per exercise | Use now: crossfade the two frames |
| ExerciseDB free GIFs | Free version is non-commercial with attribution. Code is AGPL-3.0 | Not usable |
| ExerciseDB paid dataset | One-time commercial licence (price not checked); no resale of the files | A fallback if we need hundreds of general exercises |
| Mixamo (Adobe) | Royalty-free in a project; raw files cannot be redistributed. 3D pipeline needed | Heavy for the result |
| CMU mocap database | Free, even commercially, but the data itself cannot be resold, even converted. Whether it has a clean box or drop jump is unverified | Possible source, uneven quality |
| YouTube embeds | Free, but players' phones would contact YouTube | Conflicts with the privacy stance |
| **Our own stylised figure** | Ours | **Recommended** |

### Recommendation
A small renderer draws a figure from joint positions and plays keyframes. It is on-brand, tiny (a few KB per exercise), works offline, lets the player slow it down (0.25x, 0.5x, 1x), pause and scrub, and shows each phase by name ("Load", "Jump", "Land soft"). A phase label and a cue line are the only words.
- **Capture (built 2026-10-04, see `tools/pose-capture/README.md`):** film one clean side-view rep per exercise on a phone. A script runs MediaPipe Pose (Apache-2.0, 33 landmarks), smooths it, and picks up to 10 keyframes into a JSON file, with a review page where a person checks each one against the video.
- **Components:** `MovementFigure` (requestAnimationFrame, keyframes JSON, controls) and a static pose strip for reduced motion and print.
- **Where it shows:** the player's session view and the coach's program review, for any exercise that has a figure; stills stay for the rest.
- **Content:** start with the football-specific ones the free library lacks (Nordic hamstring curl, Copenhagen adduction) plus box jump and drop jump, then the main lifts.
- **Review:** the sports scientist signs off the technique and the cues for each exercise. A figure is a coaching statement, so it is theirs to approve. Nothing implies a medical instruction.

## 4. Order of work (estimates, at about 12 hours a week)
| Step | Work | Hours |
|---|---|---|
| A | Motion tokens, the four primitives, skeleton states, approve collapse, stills crossfade | 10 |
| B | Chart kit: Band, Week, Ring, Ladder, bars. Wire into Today, player page, Agent, Program | 16 |
| C | Movement figure renderer, capture script, three exercises (box jump, drop jump, Nordic) | 20 |
| D | Ten more exercises, scientist review of each | 15 |
| E | Pain body map | 8 |
| F | View Transitions trial | 4 |
| | Total | about 73 |

A and B first (they change every screen), then C for the three that were asked about. D, E, F wait for the pilot's feedback.

## Risks
- A stylised figure can look crude. The sketch is one hand-placed pass; real poses come from video and need design iteration.
- Pose detection from a phone video may need manual cleanup. Not tested.
- Technique accuracy and cues need the sports scientist's time (about 20 minutes per exercise, my guess).
- Motion on low-end phones and battery. Test on a real phone; keep everything compositor-friendly.
- Accessibility: every chart and figure carries a text alternative; controls are real buttons; reduced motion shows a static strip.

## Decisions for the founder
1. Own figures (recommended), or a licensed GIF set for the general exercises and our own only for the football-specific ones?
2. Who films the reps, and can the sports scientist review the first three figures?
3. Order: motion and charts first (A, B), or the figures first (C)?
