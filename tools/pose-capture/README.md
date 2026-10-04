# Pose capture: from a filmed rep to a movement figure

A phone video of one rep becomes the keyframes behind the "Show me" figure. Detection runs on this computer; the video is never uploaded and never committed. Only joint positions are kept.

## Once
```
tools/pose-capture/setup.sh
```
Needs `uv`. It makes a private Python 3.12 environment in this folder. The first run also downloads the pose model (about 30 MB).

## For each exercise
1. Film it as in `docs/filming-guide.md`.
2. Run:
```
tools/pose-capture/run.sh ~/Movies/box-jump.mov tools/pose-capture/meta/box-jump.json
```
3. A review page opens. For each keyframe it shows the video frame with the detected joints next to the figure we would draw, an animated preview, and the timeline. Read the warnings first.
4. Fix what is wrong in the meta file (see below) and run the same command again; it is quick the second time.
5. When the figures match the person, run it again with `--write`. The figure is saved into `app/src/lib/movement/data/` as **unreviewed**, and the list of figures is regenerated.
6. A sports scientist checks the technique and the cues. Only then is `reviewed` changed to `true` in that figure's JSON (and the test that asserts "unreviewed" is changed on purpose).

## The meta file
`meta/*.json` holds what the video cannot tell us:
- `scene`: `box-final` (lands on a box), `box-initial` (starts on a box), `pad` (kneeling pad) or `ground`.
- `phases`: where each named phase starts, as a fraction of the movement (0 to 1). The review page draws them over the timeline so you can move them to the right moment.
- `cues`: the short coaching lines. These are a coaching statement; the sports scientist owns them.
- `startS`, `endS`: use when the clip holds more than one rep, to pick one clean rep (seconds in the original video).
- `side` (`left` or `right`, the side facing the camera) and `travel` (which way the person moves in the video) are found on their own; set them only if the page says it guessed wrong.
- `maxKeyframes` (default 10) and `tolerancePx` (default 7): raise the first, or lower the second, for a more exact follow.
- `durationMs`: how long the figure plays. By default twice the real time, between 2.4 and 6 seconds. Players can slow it further.

## What it checks and warns about
Not side-on; body cut off by the edge of the picture; the detector unsure; fewer than 60% of frames with a person; under 24 frames a second; more than one rep in the clip; a box asked for but none found; the person travelling further than the scene is wide.

## What it cannot do
- It reads one person from one camera angle. A wrong angle gives a wrong figure; the warning says so.
- It draws a stick figure with fixed bone lengths. It does not copy a person's proportions.
- The figure is only as good as the rep that was filmed. Film the technique you want players to copy.

## Notes
- MediaPipe is pinned to 0.10.21. Version 1.0.1 crashed at start-up on macOS ("Service is unavailable").
- Phone video works: H.264 and HEVC (`.mov` from an iPhone) and portrait clips with a rotation flag were tested.
- The algorithm is in `app/src/lib/movement/capture.ts` with tests that film a figure synthetically and check it comes back.
