# Navigation before and after (2026-10-04)

Same sample squad, same Sunday, run against the Firestore emulator. "Before" is commit `b0e0156` (eight tabs: Today, Squad, Map, Program, Results, Staff, Rules, Evaluation). "After" is the current branch (Today, Squad, Program and a More menu).

| Screen | Before | After |
|---|---|---|
| Today, desktop | `before-today-desktop.png` | `after-today-desktop.png` |
| Today, phone | `before-today-phone.png` | `after-today-phone.png` |
| Squad, desktop | `before-squad-desktop.png` | `after-squad-desktop.png` (People and links view) |
| Squad, phone | `before-squad-phone.png` | `after-squad-phone.png` |
| Squad map | `before` had it as its own tab | `after-squad-map-desktop.png` |
| Results / Agent | `before-results-desktop.png` | Agent is under More |
| More menu | none | `after-more-desktop.png`, `after-more-phone.png` |

The first "after" phone capture showed the header wider than the screen (More cut off, Sign out out of view). That is fixed: on a phone the tabs take their own row, and the menu opens inside the screen. A browser test now guards it.
