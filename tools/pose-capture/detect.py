"""Reads a video and writes the body landmarks MediaPipe finds in every frame, plus small thumbnails for the review page.

    tools/pose-capture/.venv/bin/python tools/pose-capture/detect.py VIDEO OUTDIR

Writes OUTDIR/landmarks.json and OUTDIR/frames/f_<n>.jpg. The video is read on this computer only and nothing is uploaded; the model file is
downloaded once into tools/pose-capture/models. The landmarks are 33 points per frame (x, y as a share of the picture, z, visibility).
"""
import json
import os
import sys
import urllib.request

import cv2
import mediapipe as mp

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task"
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "models", "pose_landmarker_heavy.task")
THUMB_WIDTH = 360


def ensure_model():
    if os.path.exists(MODEL):
        return
    os.makedirs(os.path.dirname(MODEL), exist_ok=True)
    print("Downloading the pose model once (about 30 MB)...", flush=True)
    urllib.request.urlretrieve(MODEL_URL, MODEL)


def main(video, out):
    ensure_model()
    os.makedirs(os.path.join(out, "frames"), exist_ok=True)
    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        sys.exit(f"Could not open {video}")
    cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)  # phone videos carry a rotation flag
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    vision = mp.tasks.vision
    options = vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=MODEL),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    thumb_every = max(1, round(fps / 10))
    frames, width, height, i = [], 0, 0, 0
    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            height, width = bgr.shape[:2]
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = landmarker.detect_for_video(image, int(round(i * 1000.0 / fps)))
            lm = None
            if result.pose_landmarks:
                lm = [[round(p.x, 5), round(p.y, 5), round(p.z, 5), round(p.visibility, 3)] for p in result.pose_landmarks[0]]
            frames.append({"i": i, "t": round(i / fps, 4), "lm": lm})
            if i % thumb_every == 0:
                small = cv2.resize(bgr, (THUMB_WIDTH, round(height * THUMB_WIDTH / width)))
                cv2.imwrite(os.path.join(out, "frames", f"f_{i}.jpg"), small, [cv2.IMWRITE_JPEG_QUALITY, 80])
            i += 1
            if i % 60 == 0:
                print(f"  {i} frames", flush=True)
    cap.release()
    found = sum(1 for f in frames if f["lm"])
    with open(os.path.join(out, "landmarks.json"), "w") as fh:
        json.dump({"fps": fps, "width": width, "height": height, "thumbEvery": thumb_every, "frames": frames}, fh)
    print(f"Done: {found} of {len(frames)} frames had a person. Wrote {out}/landmarks.json")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
