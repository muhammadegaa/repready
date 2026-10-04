# Filming a rep for a movement figure

One clean side-on rep per exercise is enough. About ten minutes per exercise once the camera is set up.

## What you need
- A phone. Landscape (sideways). 30 frames a second is fine; 60 is better for jumps.
- Something to hold it still: a tripod, or the phone propped against a bag. Do not hold it.
- A plain wall or open space behind the person. Good, even light. No one else in the picture.
- The person in fitted clothes (shorts, a fitted top), shoes visible. Baggy clothing hides the joints.
- Whoever is filmed should be someone whose technique you want players to copy, and should agree to be filmed. The video stays on this computer and is not shared; only joint positions are kept.

## Setting up the shot
- **Directly to the side.** The camera looks at the left or the right side of the person, not at their front. If you can see both shoulders clearly, move.
- **Camera height at the hips**, level, not tilted.
- **Far enough to fit everything.** The whole body, the box or the pad, and the room to move must stay in the picture for the entire rep, including the landing. The person should fill about two thirds of the picture height.
- **Do not move or zoom the camera** during the rep.

## Doing it
1. Start the recording. The person stands still for about a second.
2. One rep, at normal speed and with the technique you want shown.
3. Stand still for about a second at the end. Stop.
4. Do three takes. Name them clearly, for example `box-jump-1.mov`.

For each exercise:
- **Box jump:** film from the side with the box ahead of the person. They start facing the box and finish standing on it.
- **Drop jump:** the person starts standing on the box and steps off, lands, and jumps straight up.
- **Nordic hamstring curl:** the person kneels on a pad with the ankles held. Film from the side that they fall towards.

## After
Put the videos in a folder and run, for example:
```
tools/pose-capture/run.sh ~/Movies/box-jump-1.mov tools/pose-capture/meta/box-jump.json
```
A review page opens. If it warns about the angle, the edge of the picture, or more than one rep, fix that and film again or trim with `startS` and `endS` (see `tools/pose-capture/README.md`). Send the review page's figure to the sports scientist before it is marked reviewed.

Delete the videos when you are done with them.
