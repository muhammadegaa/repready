# Plan: make the product feel agentic, not like a dashboard (DRAFT, nothing built yet)

## The test we are designing to
A coach should be able to run a normal day from one screen, **Today**, without hunting through tabs. The agent brings work to Today; the coach responds; the coach leaves. Everything else is somewhere to give the agent something, or somewhere to look under the hood.

Measures: tabs a coach sees on a normal day: **8 → 3** (plus a "More" menu). Pages needed to finish the daily jobs (decide, approve routine, confirm a joiner, log minutes): **1**.

## Today's surfaces, by what they are for
| Surface | What it is | Where it goes |
|---|---|---|
| Today | The agent's inbox | Stays primary. Gains the jobs that still send you away |
| Squad | Give the agent people; manage links | Stays primary. The map becomes its default view |
| Map | Look at what the agent knows | Folded into Squad (a view, not a tab) |
| Program | Give the agent your program, fixtures, minutes | Stays primary |
| Results | How the agent is doing, plus the autonomy and rule-tuning controls | Moves to More, renamed **Agent** |
| Staff | Settings (invites, delete club) | Moves to More |
| Rules, Evaluation | Scientist tools | Move to More, under **Science** |
| Admin, Trust, Subscribe | Not part of the coach's day | Unchanged |

## Steps (each is its own commit, passes lint, types, unit, emulator and browser tests, and the build before it is pushed)
1. **Navigation.** Three primary links (Today, Squad, Program) and one "More" menu (Agent, Staff, Science). Keyboard and screen-reader friendly. "More" shows as active on its pages. Fits a phone without wrapping.
2. **Map into Squad.** `/coach/squad` opens on the map when there are players with a few days of answers, and on the people list otherwise, with a two-way toggle. `/coach/map` redirects so old links work.
3. **Results becomes Agent.** New name and heading, same content (results, ladder, tuning). `/coach/results` redirects.
4. **Today does its own jobs.** (a) Confirm join requests inline, with names and a Confirm button. (b) Log match minutes inline: the "Who played?" card expands to a text box, shows the preview, saves, and stays on Today. (c) Next week keeps its own review screen, because reviewing a whole week is a task and not a nudge, but it returns to Today.
5. **Copy and wayfinding.** Every back link says "Today". Page titles say what the page is for. Empty states say what the agent will do, not what the user must do.
6. **Prove it.** Update the browser tests for the new names and routes. Add one test that runs a normal day from the sample squad without leaving `/coach`: approve the routine trims, confirm a joiner, log minutes, see "Handled for you". Before and after screenshots on phone and desktop.
7. **Record it.** Update the plan and the live test checklist.

## Not changing
Page internals, the engine, the ladder, the limits, the trust page, the program review screen, any data. No feature is removed; things move or change name. Old URLs keep working through redirects, including links in the morning digest.

## Risks and how we handle them
- **Moved features become hard to find.** The More menu is always visible, Today nudges still point at things, and the old URLs redirect.
- **Hiding the scientist tools.** The owner keeps both roles; the tools are collapsed under More, not removed.
- **Test churn.** Several browser tests click tabs by name; they are updated in step 6, not left to fail silently.
- **Inline minutes needs the preview step on Today.** It reuses the existing reader and preview; the change is where it shows and where it returns to.

## Decisions for the founder (my recommendations in bold)
1. Scientist tools: **collapsed under More for everyone** / shown only to people invited as a scientist.
2. Name for the Results page: **Agent** / Autopilot / keep Results.
3. Squad opens on: **the map when there is enough data, else the list** / always the list.
